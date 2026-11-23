import { notFound, redirect } from "next/navigation";
import { categoryHref } from "@/components/layout/category-links";
import { categoryService } from "@/services";

type PageProps = { params: Promise<{ slug: string }> };

/** /categories/[slug] n'a pas de contenu propre : redirection vers le catalogue filtré. */
export default async function CategoryRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await categoryService.getCategoryBySlug(slug);
  if (!category) notFound();
  redirect(categoryHref(category));
}
