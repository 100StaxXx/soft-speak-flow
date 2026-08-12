import { MentorConnectionProvider } from "@/contexts/MentorConnectionContext";
import MentorChat from "@/pages/MentorChat";

export default function Guide() {
  return (
    <MentorConnectionProvider>
      <MentorChat />
    </MentorConnectionProvider>
  );
}
