import { SupportChat } from "./support-chat";

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

      <SupportChat />
    </main>
  );
}
