const foundations = [
  "Respostas vinculadas a fontes autorizadas",
  "Fallback seguro quando não há evidência",
  "Abertura de chamado somente após confirmação",
  "Arquitetura preparada para múltiplas organizações"
];

export default function HomePage() {
  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <div className="eyebrow">Fundação do projeto</div>
        <h1 id="page-title">Suporte confiável, com IA que mostra de onde veio a resposta.</h1>
        <p className="lead">
          O SupportFlow AI combina conhecimento aprovado, recuperação semântica e escalonamento humano em uma central de
          suporte rastreável.
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" />
          Web pronta para receber o fluxo do assistente
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="section-label">Princípios do MVP</p>
          <h2 id="foundation-title">Uma base pequena, explícita e segura para evoluir.</h2>
        </div>
        <ul>
          {foundations.map((foundation) => (
            <li key={foundation}>{foundation}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
