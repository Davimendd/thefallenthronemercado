# The Fallen Throne

Sistema de RPG de mesa ambientado numa realidade alternativa do universo de
*Crônicas de Gelo e Fogo* (George R. R. Martin). Site único em HTML, CSS e
JavaScript puro, com Firebase (Auth + Firestore) como backend.

## Funcionalidades

- **Fichas de personagem** — criação, edição, atributos, inventário, moedas (IC's) e aprovação pelo Mestre antes de aparecerem no mural público.
- **NPCs** — galeria de NPCs de todos os jogadores, com tipos, alinhamento e inventário.
- **Casas do Reino** — cadastro de casas nobres (lorde, lema, bandeira, sede, território, lealdade e tipo), com listagem automática dos personagens e NPCs de cada uma.
- **Mercado e Mochila** — compra, venda e equipamento de itens.
- **Exploradores** — mural público com as fichas aprovadas de todos os jogadores.
- **Photoplayers** — registro de aparências/atores usados nos personagens, com checagem de duplicidade.
- **Guia do Reino** — regras e ambientação do RPG.
- Painel exclusivo do Mestre para moderação (moedas, inventário, aprovação e exclusão de fichas/casas).

## Estrutura do projeto

```
.
├── index.html
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── script.js
│   └── img/
│       ├── throne.png
│       └── backgrounds/
│           └── bg1.jpg … bg8.jpg
└── README.md
```

## Tecnologias

- HTML5, CSS3 e JavaScript (ES Modules), sem frameworks nem etapa de build.
- [Firebase](https://firebase.google.com/) — Authentication e Cloud Firestore, carregados via CDN (`importmap` no `index.html`).

## Rodando localmente

Como é um site 100% estático, basta abrir `index.html` num servidor local (por
exemplo, a extensão *Live Server* do VS Code, ou `npx serve`). Abrir o arquivo
diretamente pelo `file://` pode não funcionar, pois os módulos ES exigem HTTP.

## Configuração do Firebase

As credenciais do Firebase (`firebaseConfig`) estão em `assets/js/script.js`.
Isso é normal para apps web do Firebase — a chave de API não é secreta, quem
protege os dados de verdade são as **regras de segurança do Firestore**
(configuradas no console do Firebase, fora deste repositório). Antes de usar
este projeto com seus próprios dados, publique regras que restrinjam leitura e
escrita apenas ao necessário.

## Licença

Projeto pessoal/hobby, sem licença de uso comercial associada.
