export default function ProfilePicture({ userImage }: { userImage: string }) {
  return user?.image ? <img src={user.image} alt="A profile picture" className="w-9 h-9 rounded-full" /> : <></>;
}
