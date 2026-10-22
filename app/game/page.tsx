"use client";

export default function GamePage() {
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f7f4ee",color:"#20231f",fontFamily:"Arial, sans-serif"}}>
      <section style={{width:"min(720px,100%)",textAlign:"center",padding:"48px 28px",border:"1px solid rgba(0,0,0,.08)",borderRadius:24,background:"rgba(255,255,255,.72)",boxShadow:"0 20px 60px rgba(0,0,0,.08)"}}>
        <div style={{fontSize:12,fontWeight:800,letterSpacing:".16em",opacity:.55}}>ZUQEN ARCADE</div>
        <h1 style={{margin:"14px 0 10px",fontSize:36}}>Play Game</h1>
        <p style={{margin:0,opacity:.65}}>Your game hub is ready. The actual game will be added here later.</p>
        <button type="button" onClick={()=>{window.location.href="/";}} style={{marginTop:28,border:0,borderRadius:12,padding:"11px 18px",background:"#b9653c",color:"#fff",fontWeight:800,cursor:"pointer"}}>Back to ZUQEN</button>
      </section>
    </main>
  );
}
