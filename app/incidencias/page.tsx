import dynamic from "next/dynamic";

// Carga dinámica para no romper si el componente usa APIs del navegador.
const KaliumIncidenciasApp = dynamic(() => import("@/components/KaliumIncidenciasApp"), { ssr: false });

export default function Page() {
  return <KaliumIncidenciasApp />;
}
