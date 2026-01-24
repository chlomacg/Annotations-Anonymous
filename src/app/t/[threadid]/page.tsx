interface PageProps {
    params: { threadid: string }
}

export default async function Page({ params }: PageProps) {
    const { threadid } = await params;

    return <h1>Thread: {threadid}</h1>
}