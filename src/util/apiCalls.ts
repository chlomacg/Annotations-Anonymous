// Placeholders until I make a backend

export function fetchRecentPosts() {
  return [
    {
      id: "01234567-0123-0123-0123-0123456789ab",
      author_id: "01234567-0123-0123-0123-0123456789ab",
      author_handle: "simplebutnoteasy",
      author_display_name: "Bill W",
      time_created: new Date(1970, 0, 1, 0, 0, 0, 0),
      content: "Hello world",
    },
    {
      id: "019c0fcc-c23a-7aaa-a2cf-af25fd3f301b",
      author_id: "019c0b92-1ded-7a59-b07b-0f297299b21d",
      author_handle: "chlomacg",
      author_display_name: "Chloe M",
      time_created: new Date(2026, 0, 30, 16, 46, 43, 225),
      content: "Hello Post",
    },
  ];
}

export function fetchPostInteractionsByUser(postId: string, userId: string) {
  return {
    liked: true,
    reposted: true,
  };
}

export function fetchReplyCountOfPost(postId: string) {
  return 2;
}

export function setPostLikedByUser(
  postId: string,
  userId: string,
  liked: boolean
) {}

export function setPostRepostedByUser(
  postId: string,
  userId: string,
  reposted: boolean
) {}
