# 🏛️ Ponto de Debate

> **Mediação epistemológica e ciência política para debates acalorados entre amigos.**  
> *100% anônimo, custo zero de infraestrutura e formatado para o WhatsApp.*

---

## 🎯 O Que É o Ponto de Debate?

O **Ponto de Debate** foi concebido para resolver o problema clássico de convivência em grupos polarizados (especialmente a tensão entre a direita liberal/conservadora ligada ao MBL e a esquerda progressista/social-democrata ligada ao PT):
- O debate colapsa em ataques pessoais (*ad hominem*).
- Amigos sentem que suas posições estão sendo rotuladas como "extremistas" ou "intolerantes".
- Boatos de redes sociais são tomados como fatos inquestionáveis.

O objetivo do Ponto de Debate **não é fazer ninguém mudar de convicção**, mas construir um ambiente onde ninguém precise abrir mão de suas posições para participar, e onde todas as afirmações precisem ser sustentadas com argumentos lógicos, evidências empíricas e responsabilidade intelectual.

---

## 🧠 Como o Mediador Pensa (Os 5 Pilares)

1. **Princípio da Caridade (*Steelmanning*):** Antes de checar fatos, reconstrói a tese de cada lado em sua melhor e mais inteligente formulação, sem caricaturas ou deboches.
2. **Separação Weberiana (Fato vs. Valor):** Distingue categoricamente o que **"É"** (dados empíricos verificáveis) do que **"DEVE SER"** (juízos éticos legítimos em sociedades plurais: Rawls vs. Nozick).
3. **Sem Falsa Equivalência (*Bothsidesism*):** Se um dado estiver comprovadamente errado, aponta o erro diretamente, venha da esquerda ou da direita. Não finge que "os dois lados têm razão" quando a ciência ou fontes oficiais apontam claramente uma direção.
4. **Fontes Oficiais e Evidências:** Análise orientada por dados de IBGE, Ipea, Banco Central, Inep/MEC, Fórum Brasileiro de Segurança Pública e literatura acadêmica consolidada.
5. **Formatação Pronta para WhatsApp:** A resposta é gerada em blocos limpos, com tópicos e negritos compatíveis com o WhatsApp, e pode ser copiada com 1 clique.

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18+) ou [Bun](https://bun.sh/)
- Uma chave gratuita da **Google Gemini API** (obtenha em segundos no [Google AI Studio](https://aistudio.google.com/))

### Passo a Passo

1. **Clone ou acerte a pasta do projeto:**
   ```bash
   cd ponto-de-debate
   ```

2. **Instale as dependências:**
   ```bash
   bun install
   # ou: npm install
   ```

3. **Configure as variáveis de ambiente:**
   Crie um arquivo `.env.local` na raiz com sua chave:
   ```env
   GEMINI_API_KEY=sua_chave_aqui_do_google_ai_studio
   # Opcional: defina um código para restringir ao grupo de amigos
   # ACCESS_CODE=meugrupo123
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   bun dev
   # ou: npm run dev
   ```
   Acesse `http://localhost:3000` no seu navegador ou celular.

---

## ☁️ Como Fazer Deploy Gratuito na Vercel

O projeto foi desenhado para rodar no plano **Hobby Gratuito da Vercel** com **Custo R$ 0,00**:

### Opção 1: Pela Vercel CLI (Direto do terminal)
```bash
# Se não tiver a cli instalada: npm i -g vercel
vercel
```
Durante o assistente, siga os passos padrão. Após a criação, adicione a variável de ambiente:
```bash
vercel env add GEMINI_API_KEY
# Insira sua chave da Gemini
vercel --prod
```

### Opção 2: Pelo Dashboard da Vercel (via GitHub)
1. Suba esta pasta para um repositório no seu GitHub.
2. Acesse [vercel.com](https://vercel.com/) e clique em **Add New Project**.
3. Importe o repositório.
4. Em **Environment Variables**, adicione:
   - `GEMINI_API_KEY`: sua chave da Gemini.
   - `ACCESS_CODE` *(opcional)*: caso queira proteger a ferramenta com senha.
5. Clique em **Deploy**.

Pronto! Você terá um link público (ex: `ponto-de-debate.vercel.app`) para compartilhar com o grupo.

---

## 🔒 Garantia de Anonimato

- **Sem banco de dados:** A aplicação é 100% *stateless*.
- **Sem login ou cadastro:** Ninguém precisa criar conta ou deixar e-mail.
- **Sem armazenamento de texto ou IP:** Os textos do debate são processados em streaming em memória e descartados imediatamente.

---

## ⚖️ Licença e Princípios

Projeto independente e aberto, dedicado à preservação do diálogo civil, da amizade e da inteligência política.
