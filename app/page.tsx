export default function Home() {
  return (
    <main style={{display:"grid", placeItems:"center", minHeight:"100dvh", padding:24}}>
      <div style={{textAlign:"center"}}>
        <h1 style={{fontSize:28, fontWeight:700, marginBottom:12}}>Kalium Network</h1>
        <a href="/incidencias" style={{textDecoration:"underline"}}>Ir al sistema de incidencias →</a>
      </div>
    </main>
  );
}
