import type { Metadata } from "next";
import { CodePad } from "./CodePad";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <CodePad />
    </main>
  );
}
