/** Remonté à chaque navigation : rejoue l'arrivée de la page. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
