import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import {
  createCloudinaryDriver,
  setUploadDriverOverride,
  type CloudinaryLike,
  type CloudinaryResult,
  type UploadDriver,
} from "../src/modules/uploads/drivers";
import { detectImageKind } from "../src/modules/uploads/signature";
import { adminAgent, http, resetDatabase } from "./helpers";

type Agent = Awaited<ReturnType<typeof adminAgent>>;
let admin: Agent;

beforeAll(async () => {
  await resetDatabase();
  admin = await adminAgent();
});

afterEach(() => setUploadDriverOverride(null));

/** PNG 1×1 valide. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF\0", "latin1"), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.from([0x1a, 0, 0, 0]), Buffer.from("WEBPVP8 ", "latin1"), Buffer.alloc(16)]);
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypavif", "latin1"), Buffer.alloc(4), Buffer.from("avifmif1", "latin1")]);

describe("signature binaire (magic bytes)", () => {
  it("reconnaît JPEG, PNG, WebP et AVIF", () => {
    expect(detectImageKind(JPEG)?.ext).toBe("jpg");
    expect(detectImageKind(PNG)?.ext).toBe("png");
    expect(detectImageKind(WEBP)?.ext).toBe("webp");
    expect(detectImageKind(AVIF)?.ext).toBe("avif");
  });

  it("refuse texte, HTML, SVG, GIF, MP4 (ftyp non AVIF) et fichiers trop courts", () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic", "latin1"), Buffer.alloc(16)]);
    for (const buf of [
      Buffer.from("ceci est du texte, pas une image"),
      Buffer.from("<html><script>alert(1)</script></html>"),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;;;;;;;;", "latin1"),
      heic,
      Buffer.from([0xff, 0xd8]),
      Buffer.alloc(0),
    ]) {
      expect(detectImageKind(buf)).toBeNull();
    }
  });
});

describe("POST /api/admin/uploads (driver local)", () => {
  it("exige une session", async () => {
    const res = await http().post("/api/admin/uploads").attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("accepte un vrai PNG : 201 { url, publicId }, nom aléatoire, fichier écrit puis servi", async () => {
    const res = await admin.post("/api/admin/uploads").attach("file", PNG, { filename: "ma photo perso.png", contentType: "image/png" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    expect(res.body.publicId).toMatch(/^[0-9a-f]{32}\.png$/);
    expect(res.body.url).not.toContain("photo");
    expect(readFileSync(join(env.UPLOAD_DIR, res.body.publicId)).equals(PNG)).toBe(true);

    const served = await http().get(res.body.url);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
  });

  it("ignore le type MIME et le nom envoyés : le format réel décide de l'extension", async () => {
    const res = await admin.post("/api/admin/uploads").attach("file", JPEG, { filename: "../../evil.php", contentType: "text/plain" });
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f]{32}\.jpg$/);
    const webp = await admin.post("/api/admin/uploads").attach("file", WEBP, { filename: "x.png", contentType: "image/png" });
    expect(webp.body.url).toMatch(/\.webp$/);
    const avif = await admin.post("/api/admin/uploads").attach("file", AVIF, { filename: "x.jpg", contentType: "image/jpeg" });
    expect(avif.body.url).toMatch(/\.avif$/);
    // Aucun fichier hors du dossier d'upload.
    expect(readdirSync(env.UPLOAD_DIR).every((f) => /^[0-9a-f]{32}\.(png|jpg|webp|avif)$/.test(f))).toBe(true);
  });

  it("refuse un fichier texte déguisé en .png avec le type image/png", async () => {
    const before = readdirSync(env.UPLOAD_DIR).length;
    const res = await admin
      .post("/api/admin/uploads")
      .attach("file", Buffer.from("je ne suis pas une image, juste du texte déguisé"), { filename: "faux.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(readdirSync(env.UPLOAD_DIR).length).toBe(before);
  });

  it("refuse un SVG / HTML même annoncé comme image/png", async () => {
    for (const content of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<html><body>x</body></html>"]) {
      const res = await admin.post("/api/admin/uploads").attach("file", Buffer.from(content), { filename: "x.png", contentType: "image/png" });
      expect(res.status).toBe(400);
    }
  });

  it("refuse un fichier de plus de 5 Mo (413 VALIDATION)", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await admin.post("/api/admin/uploads").attach("file", big, { filename: "gros.png", contentType: "image/png" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("accepte un fichier juste sous la limite", async () => {
    const ok = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 - PNG.length - 1024)]);
    const res = await admin.post("/api/admin/uploads").attach("file", ok, { filename: "ok.png", contentType: "image/png" });
    expect(res.status).toBe(201);
  });

  it("refuse l'absence de fichier, un mauvais nom de champ et plusieurs fichiers", async () => {
    const none = await admin.post("/api/admin/uploads").field("x", "y");
    expect(none.status).toBe(400);
    const wrongField = await admin.post("/api/admin/uploads").attach("image", PNG, { filename: "a.png", contentType: "image/png" });
    expect(wrongField.status).toBe(400);
    const two = await admin
      .post("/api/admin/uploads")
      .attach("file", PNG, { filename: "a.png", contentType: "image/png" })
      .attach("file", PNG, { filename: "b.png", contentType: "image/png" });
    expect(two.status).toBe(400);
    const json = await admin.post("/api/admin/uploads").send({ file: "x" });
    expect(json.status).toBe(400);
  });
});

describe("driver cloudinary", () => {
  const withCloudinaryEnv = async (creds: Partial<Record<"CLOUDINARY_CLOUD_NAME" | "CLOUDINARY_API_KEY" | "CLOUDINARY_API_SECRET", string>>, run: () => Promise<void>) => {
    const saved = { driver: env.UPLOAD_DRIVER, name: env.CLOUDINARY_CLOUD_NAME, key: env.CLOUDINARY_API_KEY, secret: env.CLOUDINARY_API_SECRET };
    env.UPLOAD_DRIVER = "cloudinary";
    env.CLOUDINARY_CLOUD_NAME = creds.CLOUDINARY_CLOUD_NAME;
    env.CLOUDINARY_API_KEY = creds.CLOUDINARY_API_KEY;
    env.CLOUDINARY_API_SECRET = creds.CLOUDINARY_API_SECRET;
    try {
      await run();
    } finally {
      env.UPLOAD_DRIVER = saved.driver;
      env.CLOUDINARY_CLOUD_NAME = saved.name;
      env.CLOUDINARY_API_KEY = saved.key;
      env.CLOUDINARY_API_SECRET = saved.secret;
    }
  };

  it("sans identifiants : 501 NOT_CONFIGURED, et rien n'est écrit sur le disque", async () => {
    const before = readdirSync(env.UPLOAD_DIR).length;
    await withCloudinaryEnv({}, async () => {
      const res = await admin.post("/api/admin/uploads").attach("file", PNG, { filename: "a.png", contentType: "image/png" });
      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe("NOT_CONFIGURED");
    });
    await withCloudinaryEnv({ CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "k" }, async () => {
      const res = await admin.post("/api/admin/uploads").attach("file", PNG, { filename: "a.png", contentType: "image/png" });
      expect(res.status).toBe(501);
    });
    expect(readdirSync(env.UPLOAD_DIR).length).toBe(before);
  });

  it("createCloudinaryDriver envoie le tampon dans le dossier configuré et renvoie secure_url + public_id", async () => {
    const calls: Array<{ options: Record<string, unknown>; sent: Buffer[] }> = [];
    const fake: CloudinaryLike = {
      uploader: {
        upload_stream(options, callback) {
          const call = { options: { ...options }, sent: [] as Buffer[] };
          calls.push(call);
          return {
            end(buffer: Buffer) {
              call.sent.push(buffer);
              const result: CloudinaryResult = { secure_url: `https://res.cloudinary.test/${options.folder}/${options.public_id}.png`, public_id: `${options.folder}/${options.public_id}` };
              callback(undefined, result);
            },
          };
        },
      },
    };
    const driver = createCloudinaryDriver(fake, "maison-atlas");
    const saved = await driver.save({ buffer: PNG, kind: { mime: "image/png", ext: "png" }, baseName: "abc123" });
    expect(saved).toEqual({ url: "https://res.cloudinary.test/maison-atlas/abc123.png", publicId: "maison-atlas/abc123" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.options).toMatchObject({ folder: "maison-atlas", public_id: "abc123", resource_type: "image", overwrite: false });
    expect(calls[0]!.sent[0]!.equals(PNG)).toBe(true);
  });

  it("propage une erreur du service Cloudinary", async () => {
    const failing: CloudinaryLike = {
      uploader: { upload_stream: (_o, cb) => ({ end: () => cb(new Error("boom"), undefined) }) },
    };
    await expect(createCloudinaryDriver(failing, "f").save({ buffer: PNG, kind: { mime: "image/png", ext: "png" }, baseName: "x" })).rejects.toThrow("boom");
  });

  it("de bout en bout avec un faux driver : 201 avec l'URL du CDN ; une panne donne un 500 sans détail", async () => {
    const received: string[] = [];
    const fake: UploadDriver = {
      name: "cloudinary",
      async save({ kind, baseName }) {
        received.push(`${baseName}.${kind.ext}`);
        return { url: `https://cdn.test/${baseName}.${kind.ext}`, publicId: `maison-atlas/${baseName}` };
      },
    };
    setUploadDriverOverride(fake);
    const res = await admin.post("/api/admin/uploads").attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^https:\/\/cdn\.test\/[0-9a-f]{32}\.png$/);
    expect(res.body.publicId).toMatch(/^maison-atlas\/[0-9a-f]{32}$/);
    expect(received).toHaveLength(1);
    // Fichier invalide : le driver n'est même pas appelé.
    await admin.post("/api/admin/uploads").attach("file", Buffer.from("pas une image du tout"), { filename: "a.png", contentType: "image/png" }).expect(400);
    expect(received).toHaveLength(1);

    setUploadDriverOverride({ name: "cloudinary", save: () => Promise.reject(new Error("clé secrète XYZ invalide")) });
    const down = await admin.post("/api/admin/uploads").attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(down.status).toBe(500);
    expect(down.body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(down.body)).not.toContain("XYZ");
  });
});
