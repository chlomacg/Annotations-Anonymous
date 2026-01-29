interface PageProps {
  params: { postid: string };
}

export default async function Page({ params }: PageProps) {
  const { postid } = await params;
}
