import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, collectionGroup, getDocs } from "firebase/firestore";

// Abaixo daqui, verifique se NÃO existe nenhuma linha como:
// const getAuth = ... ou outro import { getAuth } ...

// ... restante das configurações (firebaseConfig)

// Avatar padrão para quem ainda não definiu uma foto de perfil.
// Fica no topo de propósito, junto das outras constantes que não dependem
// do Firebase, para nunca correr o risco de ser usada antes de existir.
const AVATAR_PADRAO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231c1812'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%233a3326'/%3E%3Cpath d='M10 58c0-14 9.8-22 22-22s22 8 22 22' fill='%233a3326'/%3E%3C/svg%3E";

// =========================================
// 0. SISTEMA DE TOAST E CONFIRMAÇÃO
// Ficam no topo de propósito: não dependem do Firebase e substituem
// os alert()/confirm() nativos do navegador por algo que combina com o tema.
// =========================================
function mostrarToast(mensagem, tipo = 'sucesso', titulo = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <div>
            ${titulo ? `<strong>${titulo}</strong><br>` : ''}
            ${mensagem}
        </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('saindo');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function mostrarConfirmacao(mensagem) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-overlay');
        overlay.innerHTML = `
            <div class="confirm-box">
                <p>${mensagem}</p>
                <div class="confirm-botoes">
                    <button id="confirm-cancelar">Cancelar</button>
                    <button id="confirm-aceitar">Confirmar</button>
                </div>
            </div>
        `;
        overlay.style.display = 'flex';

        const limpar = (resultado) => {
            overlay.style.display = 'none';
            overlay.innerHTML = '';
            resolve(resultado);
        };

        document.getElementById('confirm-aceitar').onclick = () => limpar(true);
        document.getElementById('confirm-cancelar').onclick = () => limpar(false);
    });
}

// =========================================
// NAVEGAÇÃO ENTRE PÁGINAS (Mercado / Mochila / Exploradores)
// Fica no topo de propósito: não depende do Firebase, então funciona
// mesmo antes do login terminar de carregar.
// =========================================
function mostrarPagina(nomePagina) {
    const paginas = ['vitrine', 'fichas', 'mochila', 'mural'];

    paginas.forEach(p => {
        document.getElementById('pagina-' + p).style.display = (p === nomePagina) ? 'block' : 'none';
    });

    document.querySelectorAll('.pagina-tab').forEach((tab, i) => {
        tab.classList.toggle('ativa', paginas[i] === nomePagina);
    });
}

// Atualiza o número exibido no badge do ícone flutuante de mochila
function atualizarBadgeMochila(quantidade) {
    const badge = document.getElementById('badge-mochila');
    if (!badge) return;
    if (quantidade > 0) {
        badge.style.display = 'flex';
        badge.innerText = quantidade > 99 ? '99+' : quantidade;
    } else {
        badge.style.display = 'none';
    }
}

// 1. SUA LISTA DE ITENS
// Fica ANTES da inicialização do Firebase de propósito: assim a vitrine
// é montada e exibida mesmo que o Firebase falhe, esteja fora do ar,
// ou tenha um erro de configuração.
//
// Campo "mecanica" define o efeito jogável do item sobre a ficha ativa:
//   { tipo: 'arma' }                      -> pode ser equipado (slot de arma)
//   { tipo: 'armadura', defesa: N }       -> pode ser equipado (slot de armadura), soma N de Defesa
//   { tipo: 'cura', vida: N }             -> consumível: ao usar, cura N de Vida Atual
//   { tipo: 'vidaMaxima', valor: N }      -> consumível: ao usar, aumenta a Vida Máxima em N (permanente)
//   { tipo: 'nenhum' }                    -> consumível ou item sem efeito mecânico (só narrativo)
const itensMercado = [
    { nome: "Adaga de Aço Comum", 
      tipo: "Arma",
      raridade: "comum",
      preco: 60,
      imagem: "https://png.pngtree.com/png-vector/20231115/ourmid/pngtree-ancient-roman-dagger-knife-png-image_10592942.png", // Link da imagem
      efeito: "1d4 + Agilidade",
      mecanica: { tipo: "arma" },
      desc: "Aço barato." },

    { nome: "Espada de Aço de Castelo",
      tipo: "Arma",
      raridade: "incomum",
      preco: 400,
      imagem: "https://acdn-us.mitiendanube.com/stores/007/070/236/products/bxg01-1-18d15693c0cec782e917684061205550-1024-1024.webp", // Link da imagem
      efeito: "1d8 + Força",
      mecanica: { tipo: "arma" },
      desc: "Equilibrada." },

    { nome: "Lança de Vidro de Dragão",
      tipo: "Arma",
      raridade: "epico",
      preco: 2500,
      imagem: "https://gbf.wiki/images/thumb/2/23/Weapon_b_1020201100.png/462px-Weapon_b_1020201100.png", // Link da imagem
      efeito: "1d10 + Agi",
      mecanica: { tipo: "arma" },
      desc: "Obsidiana pura." },

    { nome: "Espada de Aço Valiriano",
      tipo: "Arma",
      raridade: "lendario",
      preco: 9500,
      imagem: "https://cdna.artstation.com/p/assets/images/images/029/004/974/large/andrew-demel-darkswordcolor1.jpg?1596159620", // Link da imagem
      efeito: "2d6 + Força",
      mecanica: { tipo: "arma" },
      desc: "Relíquia ancestral." },

    { nome: "Gibão de Couro Batido",
        tipo: "Armadura",
        raridade: "comum",
        preco: 120,
        imagem: "https://i.etsystatic.com/60627043/r/il/48c638/7200589820/il_340x270.7200589820_mzji.jpg", // Link da imagem
        efeito: "+2 Defesa",
        mecanica: { tipo: "armadura", defesa: 2 },
        desc: "Leve." },

    { nome: "Cota de Malha",
      tipo: "Armadura",
      raridade: "incomum",
      preco: 600,
      imagem: "https://loxwoodjoust.co.uk/wp-content/uploads/2022/07/KnightinChainmail_adobe1280x853-1024x682.jpg", // Link da imagem
      efeito: "+4 Defesa",
      mecanica: { tipo: "armadura", defesa: 4 },
      desc: "Proteção pesada." },

    { nome: "Leite de Papoula",
      tipo: "Consumível",
      raridade: "raro",
      preco: 150,
      imagem: "https://awoiaf.westeros.org/images/thumb/9/99/Milk_of_the_poppy.jpg/350px-Milk_of_the_poppy.jpg", // Link da imagem
      efeito: "Cura 6 de Vida",
      mecanica: { tipo: "cura", vida: 6 },
      desc: "Analgésico." },

    { 
        nome: "Machado de Guerra", 
        tipo: "Arma", 
        raridade: "raro", 
        preco: 850, 
        imagem: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPadPXU7wzPrE2Tkpa0FoTmjtWo3dQB0n-5A&s",
        efeito: "1d10 + Força (Pesada)", 
        mecanica: { tipo: "arma" },
        desc: "Capaz de partir escudos de madeira com facilidade." 
    },

    { 
        nome: "Arco de Madeira de Represeiro", 
        tipo: "Arma", 
        raridade: "epico", 
        preco: 2200, 
        imagem: "https://cdnb.artstation.com/p/assets/images/images/044/887/555/large/mike-kokkinos-screenshot1.jpg?1641403101",
        efeito: "1d8 + Agi (Crítico 18-20)", 
        mecanica: { tipo: "arma" },
        desc: "Madeira sagrada do Norte, extremamente flexível." 
    },

    { 
        nome: "Irmã Sombria (Réplica)", 
        tipo: "Arma", 
        raridade: "lendario", 
        preco: 9500, 
        imagem: "https://cdnb.artstation.com/p/assets/covers/images/000/896/417/large/raphael-lima-dark-sister-01.jpg?1435590877",
        efeito: "2d6 + Força + Sangramento", 
        mecanica: { tipo: "arma" },
        desc: "Inspirada na espada de Visenya Targaryen." 
    },

    { 
        nome: "Escudo com Brasão", 
        tipo: "Armadura", 
        raridade: "raro", 
        preco: 900, 
        imagem: "https://thumbs.dreamstime.com/b/medieval-crusader%C3%A2%E2%82%AC%E2%84%A2s-metal-shield-isolated-white-large-medieval-crusader-s-metal-shield-isolated-white-background-359899733.jpg",
        efeito: "+3 Defesa", 
        mecanica: { tipo: "armadura", defesa: 3 },
        desc: "Um escudo reforçado com as cores da sua Casa." 
    },

    { 
        nome: "Armadura de Placas Completa", 
        tipo: "Armadura", 
        raridade: "epico", 
        preco: 3500, 
        imagem: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCHd4S0QFy6UFGXUjlUrUVPJrZxgMlLmpdtw&s",
        efeito: "+10 Defesa", 
        mecanica: { tipo: "armadura", defesa: 10 },
        desc: "A defesa máxima para um campeão." 
    },

    { 
        nome: "Fogovivo (Pote)", 
        tipo: "Consumível", 
        raridade: "epico", 
        preco: 1800, 
        imagem: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSgvGhQ8nZSYcnLr-dUTwdJF7a4D1igVSvg3w&s",
        efeito: "4d6 Dano de Área (Fogo)", 
        mecanica: { tipo: "nenhum" },
        desc: "A substância perigosa dos alquimistas." 
    },

    { 
        nome: "Vinho da Árvore", 
        tipo: "Consumível", 
        raridade: "raro", 
        preco: 250, 
        imagem: "https://i.pinimg.com/474x/a9/da/43/a9da43d7650fda383714b389f7277877.jpg",
        efeito: "Recupera Fôlego, podendo fazer duas ações em um turno.", 
        mecanica: { tipo: "nenhum" },
        desc: "O melhor vinho de Westeros." 
    },

    { 
        nome: "Amuleto da Velha Saga", 
        tipo: "Consumível", 
        raridade: "lendario", 
        preco: 6500, 
        imagem: "https://i.pinimg.com/originals/9c/9b/2e/9c9b2e3e6f4b6f4d6f4b6f4b6f4b6f4b.jpg",
        efeito: "Aumenta a Vida Máxima em 8 permanentemente", 
        mecanica: { tipo: "vidaMaxima", valor: 8 },
        desc: "Uma relíquia gravada com runas perdidas. Diz-se que fortalece o próprio sangue de quem a consome." 
    },

    { 
        nome: "Cura Maior dos Meistres", 
        tipo: "Consumível", 
        raridade: "epico", 
        preco: 1200, 
        imagem: "https://i.pinimg.com/originals/3b/3a/3e/3b3a3e6f4b6f4d6f4b6f4b6f4b6f4b6f.jpg",
        efeito: "Cura 14 de Vida", 
        mecanica: { tipo: "cura", vida: 14 },
        desc: "Preparo avançado da Cidadela, reservado a feridas graves." 
    },

];

let usuarioAtual = null;

// =========================================
// DADOS DO SISTEMA DE FICHAS (classes, atributos, habilidades, moedas)
// Ficam antes do Firebase de propósito, pelo mesmo motivo dos itens:
// são dados estáticos que não dependem de rede.
// =========================================
const classesPorOrigem = {
    "Nobre": ["Cavaleiros", "Diplomatas", "Meistres", "Septãos", "Guerreiros", "Comerciantes"],
    "Plebeu": [
        "Ladinos", "Patrulheiros", "Ferreiros", "Mercenários", "Guerreiros",
        "Prostitutas", "Sacerdotes", "Piromantes", "Umbromantes",
        "Feiticeiras de Asshai", "Magos de Sangue", "Magos de Qarth", "Homens Sem Rosto"
    ]
};

const atributosPorClasse = {
    "Cavaleiros": { for: 4, agi: 2, vig: 3, int: 0, car: 1 },
    "Diplomatas": { for: 0, agi: 1, vig: 1, int: 4, car: 4 },
    "Meistres": { for: 0, agi: 1, vig: 1, int: 5, car: 3 },
    "Septãos": { for: 0, agi: 1, vig: 2, int: 3, car: 4 },
    "Guerreiros": { for: 3, agi: 3, vig: 3, int: 1, car: 0 },
    "Comerciantes": { for: 0, agi: 2, vig: 1, int: 3, car: 4 },
    "Ladinos": { for: 1, agi: 4, vig: 1, int: 2, car: 2 },
    "Patrulheiros": { for: 2, agi: 3, vig: 3, int: 2, car: 0 },
    "Ferreiros": { for: 4, agi: 1, vig: 4, int: 1, car: 0 },
    "Mercenários": { for: 3, agi: 2, vig: 3, int: 2, car: 0 },
    "Prostitutas": { for: 0, agi: 3, vig: 1, int: 2, car: 4 },
    "Sacerdotes": { for: 1, agi: 1, vig: 2, int: 3, car: 3 },
    "Piromantes": { for: 0, agi: 2, vig: 1, int: 5, car: 2 },
    "Umbromantes": { for: 0, agi: 3, vig: 1, int: 4, car: 2 },
    "Feiticeiras de Asshai": { for: 0, agi: 2, vig: 2, int: 4, car: 2 },
    "Magos de Sangue": { for: 1, agi: 1, vig: 4, int: 4, car: 0 },
    "Magos de Qarth": { for: 0, agi: 1, vig: 1, int: 4, car: 4 },
    "Homens Sem Rosto": { for: 2, agi: 4, vig: 1, int: 3, car: 0 }
};

// Moedas iniciais por classe: nobres e classes ligadas a dinheiro/comércio
// começam com mais; classes marginais ou místicas, com menos.
const moedasIniciaisPorClasse = {
    "Comerciantes": 2800,
    "Cavaleiros": 2200,
    "Diplomatas": 2000,
    "Septãos": 1400,
    "Meistres": 1300,
    "Guerreiros": 1200,
    "Mercenários": 1100,
    "Ferreiros": 1000,
    "Sacerdotes": 900,
    "Patrulheiros": 800,
    "Prostitutas": 750,
    "Homens Sem Rosto": 700,
    "Ladinos": 600,
    "Piromantes": 600,
    "Umbromantes": 500,
    "Magos de Qarth": 500,
    "Feiticeiras de Asshai": 400,
    "Magos de Sangue": 400
};

const habilidadesPorClasse = {
    "Cavaleiros": {
        nome: "🛡️ Postura da Honra",
        desc: "Ao defender um aliado, você assume o golpe em seu lugar.",
        efeito: "Role 1d20 + Vigor",
        tabela: "<li><strong>15+:</strong> reduz dano em 50% e +3 Defesa (por 3 turnos)</li><li><strong>10–14:</strong> recebe dano total, aliado seguro, 3 de defesa (2 turnos)</li><li><strong><10:</strong> ambos recebem metade do dano</li>"
    },
    "Diplomatas": {
        nome: "🗣️ Palavras de Ouro",
        desc: "Você tenta convencer, manipular ou acalmar uma situação.",
        efeito: "Role 1d20 + Carisma",
        tabela: "<li><strong>15+:</strong> Alvo coopera totalmente (Vantagem em testes)</li><li><strong>10–14:</strong> Cooperação parcial (+3 em teste)</li><li><strong><10:</strong> Desconfiança ou piora</li>"
    },
    "Meistres": {
        nome: "📚 Conhecimento Antigo",
        desc: "Acesse saber oculto para resolver problemas.",
        efeito: "Role 1d20 + Intelecto",
        tabela: "<li><strong>15+:</strong> Revela fraqueza (+3 em testes) e Poção Maior (2d6 cura)</li><li><strong>10–14:</strong> Pista útil e Poção Menor (1d6 cura)</li><li><strong><10:</strong> Informação errada</li>"
    },
    "Septãos": {
        nome: "✝️ Benção dos Sete",
        desc: "Invoca fé para proteger ou curar.",
        efeito: "Role 1d20 + Carisma",
        tabela: "<li><strong>15+:</strong> Cura Grande (2d6) ou +3 Defesa</li><li><strong>10–14:</strong> Cura Leve (1d6) ou +1 Defesa</li><li><strong><10:</strong> Sem efeito</li>"
    },
    "Guerreiros": {
        nome: "⚔️ Golpe Brutal",
        desc: "Ataque direto com força total.",
        efeito: "Role 1d20 + Força",
        tabela: "<li><strong>15+:</strong> Dano Crítico (3x)</li><li><strong>10–14:</strong> Dano Normal +1 dado</li><li><strong><10:</strong> Ataque falha</li>"
    },
    "Comerciantes": {
        nome: "💰 Acordo Lucrativo",
        desc: "Manipula preços e negociações.",
        efeito: "Role 1d20 + Carisma",
        tabela: "<li><strong>15+:</strong> Desconto grande e +50% lucro</li><li><strong>10–14:</strong> Negociação justa (+25% lucro)</li><li><strong><10:</strong> Prejuízo</li>"
    },
    "Ladinos": {
        nome: "🗡️ Ataque nas Sombras",
        desc: "Golpe furtivo quando não detectado.",
        efeito: "Role 1d20 + Agilidade",
        tabela: "<li><strong>15+:</strong> 5d6 dano + ignora Defesa</li><li><strong>10–14:</strong> 2d6 dano</li><li><strong><10:</strong> Detectado</li>"
    },
    "Patrulheiros": {
        nome: "🌲 Olhos da Floresta",
        desc: "Rastrear ou prever perigos.",
        efeito: "Role 1d20 + Agilidade",
        tabela: "<li><strong>15+:</strong> Evita emboscada e Vantagem Ataque de Longa Distância</li><li><strong>10–14:</strong> Detecta presença ou direção de alvo</li><li><strong><10:</strong> Pista falsa</li>"
    },
    "Ferreiros": {
        nome: "🔨 Arma Reforjada",
        desc: "Melhora equipamentos por 24 horas.",
        efeito: "Role 1d20 + Força ou Intelecto",
        tabela: "<li><strong>15+:</strong> Arma +1 dado de dano ou Armadura +3 Defesa</li><li><strong>10–14:</strong> +3 de dano ou +1 de armadura</li><li><strong><10:</strong> Falha</li>"
    },
    "Mercenários": {
        nome: "🪓 Sem Lealdade",
        desc: "Luta melhor quando há recompensa.",
        efeito: "Role 1d20 + Vigor",
        tabela: "<li><strong>15+:</strong> +5 em Ataque e Defesa em missões (3 turnos)</li><li><strong>10–14:</strong> +3 em Ataque (1 turno)</li><li><strong><10:</strong> Luta normal</li>"
    },
    "Prostitutas": {
        nome: "💃 Sedução Perigosa",
        desc: "Manipula emoções e desejos 1 vez por dia.",
        efeito: "Role 1d20 + Carisma",
        tabela: "<li><strong>15+:</strong> Alvo vulnerável (-5 Defesa ou Segredo ou 2d6 de vida)</li><li><strong>10–14:</strong> Distração (-3 Defesa e 1d6 de vida)</li><li><strong><10:</strong> Resiste</li>"
    },
    "Sacerdotes": {
        nome: "🔥 Chama da Fé",
        desc: "Invoca poder divino (R'hllor).",
        efeito: "Role 1d20 + Carisma",
        tabela: "<li><strong>15+:</strong> Barganha ou Visão (Consultar ADM)</li><li><strong>10–14:</strong> 1d6 dano em área (ou no usuário caso não tiver alvo)</li><li><strong><10:</strong> Falha</li>"
    },
    "Piromantes": {
        nome: "🧪 Fogo Vivo",
        desc: "Cria explosões de fogovivo.",
        efeito: "Role 1d20 + Intelecto",
        tabela: "<li><strong>15+:</strong> 4d6 dano em área (Agi reduz metade)</li><li><strong>10–14:</strong> 2d6 dano em 3 alvos</li><li><strong><10:</strong> Instável (Ímpar: recebe 2d6)</li>"
    },
    "Umbromantes": {
        nome: "🌑 Forma Sombria",
        desc: "Manipula sombras.",
        efeito: "Role 1d20 + Intelecto",
        tabela: "<li><strong>15+:</strong> Sombra Assassina (2d10) ou Intangível</li><li><strong>10–14:</strong> Invisível e +3 Defesa</li><li><strong><10:</strong> Falha</li>"
    },
    "Feiticeiras de Asshai": {
        nome: "🔮 Magia Abissal",
        desc: "Poder antigo e proibido.",
        efeito: "Role 1d20 + Intelecto",
        tabela: "<li><strong>15+:</strong> Controle Mental ou 3d6 dano</li><li><strong>10–14:</strong> Efeito parcial</li><li><strong><10:</strong> Custo Alto (perde 2d8 Vida)</li>"
    },
    "Magos de Sangue": {
        nome: "🩸 Sacrifício Vital",
        desc: "Usa vida para amplificar magia.",
        efeito: "Perde 1d6 Vida por turno → Role 1d20 + Intelecto",
        tabela: "<li><strong>15+:</strong> Todos os alvos sangram (2d6 Vida por turno enquanto manter)</li><li><strong>10–14:</strong> Um alvo perde 2d8 Vida</li><li><strong><10:</strong> Magia falha</li>"
    },
    "Magos de Qarth": {
        nome: "🏜️ Ilusão Arcana",
        desc: "Cria ilusões realistas.",
        efeito: "Role 1d20 + Intelecto",
        tabela: "<li><strong>15+:</strong> 1d10 dano ilusório ou Condição Mental</li><li><strong>10–14:</strong> Confusão (-5 em testes)</li><li><strong><10:</strong> Falha</li>"
    },
    "Homens Sem Rosto": {
        nome: "🎭 Muitas Faces",
        desc: "Assume identidade de outro.",
        efeito: "Role 1d20 + Carisma",
        tabela: "<li><strong>15+:</strong> Disfarce Perfeito e Vantagem em ataques desprevenidos e +3d6 de dano</li><li><strong>10–14:</strong> Convincente mas imperfeito, +5 em ataques desprevenidos</li><li><strong><10:</strong> Identidade suspeita</li>"
    }
};

// Calcula vida máxima e defesa base de uma ficha a partir da origem e classe
function calcularStatusBase(origem, classe) {
    const attr = atributosPorClasse[classe] || { for: 0, agi: 0, vig: 0, int: 0, car: 0 };
    const vidaBase = (origem === "Nobre") ? 16 : 20;
    const defesaBase = (origem === "Nobre") ? 12 : 10;
    return {
        vidaMaxima: vidaBase + attr.vig,
        defesaBase: defesaBase + attr.agi
    };
}

// RENDERIZA A LOJA IMEDIATAMENTE
// Isso garante que os itens aparecem mesmo se o Firebase falhar, demorar ou der erro.
// (a função filtrarItens é definida mais abaixo, mas o JS já "conhece" funções
// declaradas com 'function' antes delas aparecerem no arquivo — hoisting)
window.filtrarItens = filtrarItens;
try {
    filtrarItens('todos');
} catch (erroInicial) {
    console.error("Erro ao renderizar a vitrine inicial:", erroInicial);
}

// Avatar padrão no ícone flutuante até que os dados do usuário cheguem
try {
    document.getElementById('avatar-flutuante').src = AVATAR_PADRAO;
} catch (erroAvatarInicial) {
    console.error("Erro ao definir avatar inicial:", erroAvatarInicial);
}

// 2. COLOQUE SEUS DADOS DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "AIzaSyDaEGg2wS3N47nxeOrJRHV0-4Cd41MLIaA",
    authDomain: "the-fallen-throne.firebaseapp.com",
    projectId: "the-fallen-throne",
    storageBucket: "the-fallen-throne.firebasestorage.app",
    messagingSenderId: "136052504846",
    appId: "1:136052504846:web:a705dd5763a644c9643f5f"
};

const ADMIN_UID = "MQZd3bjnchaop9y8tRQvLqNBNaz1"; // Você descobre esse ID no console do Firebase após logar

// Inicialização protegida: se o Firebase falhar (chave errada, projeto fora do
// ar, sem internet), a loja continua visível e só os recursos que dependem de
// login/banco de dados ficam indisponíveis, em vez da página inteira travar.
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (erroFirebase) {
    console.error("Falha ao inicializar o Firebase:", erroFirebase);
}

// Esconde a tela de login com uma transição suave
function esconderTelaDeLogin() {
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.add('saindo');
    document.getElementById('conta-flutuante').style.display = 'block';
    document.getElementById('botao-mochila-flutuante').style.display = 'flex';
}

// Mostra a tela de login novamente (usado no logout)
function mostrarTelaDeLogin() {
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.remove('saindo');
    document.getElementById('menu-conta').style.display = 'none';
    document.getElementById('conta-flutuante').style.display = 'none';
    document.getElementById('botao-mochila-flutuante').style.display = 'none';
    document.getElementById('painel-mestre').style.display = 'none';
    mostrarPagina('vitrine');
}

// 3. MONITORAMENTO DE LOGIN E DADOS
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioAtual = user;
            if (user.uid === ADMIN_UID) {
                document.getElementById('painel-mestre').style.display = 'block';
            }
            escutarDadosUsuario(user.uid);
            escutarAvisoGlobal(); // Nova função
            esconderTelaDeLogin();
        } else {
            usuarioAtual = null;
            mostrarTelaDeLogin();
        }
    });
}

// --- ÍCONE FLUTUANTE DE CONTA ---
function alternarMenuConta() {
    const menu = document.getElementById('menu-conta');
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

async function trocarDeConta() {
    const confirmado = await mostrarConfirmacao('Sair da conta atual e voltar à tela de login?');
    if (!confirmado) return;

    try {
        await signOut(auth);
        mostrarToast('Até a próxima jornada, aventureiro.', 'sucesso', 'Conta encerrada');
    } catch (error) {
        mostrarToast('Não foi possível sair da conta agora.', 'erro', 'Erro');
    }
}

// 1. Funções para Troca de Nome
function mostrarTrocaNome() {
    const div = document.getElementById('input-troca-nome');
    div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

async function salvarNovoNome() {
    const novoNome = document.getElementById('novo-nome-input').value;
    if (!novoNome) return mostrarToast('Escolha um nome válido para seu herói.', 'erro', 'Nome inválido');
    if (!fichaAtivaId) return mostrarToast('Nenhuma ficha ativa selecionada.', 'erro', 'Erro');

    try {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId), { nome: novoNome });
        
        document.getElementById('input-troca-nome').style.display = 'none';
        document.getElementById('novo-nome-input').value = '';
        mostrarToast(`Agora sois conhecido como ${novoNome}.`, 'sucesso', 'Nome alterado');
    } catch (error) {
        mostrarToast('Não foi possível trocar o nome agora.', 'erro', 'Erro');
    }
}

// Avatar padrão para quem ainda não definiu uma foto de perfil
function mostrarTrocaFoto() {
    const div = document.getElementById('input-troca-foto');
    div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

async function salvarNovaFoto() {
    const novaFoto = document.getElementById('nova-foto-input').value.trim();
    if (!novaFoto) return mostrarToast('Cole o link de uma imagem válida.', 'erro', 'Link inválido');
    if (!fichaAtivaId) return mostrarToast('Nenhuma ficha ativa selecionada.', 'erro', 'Erro');

    try {
        await validarUrlDeImagem(novaFoto);

        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId), { foto: novaFoto });

        document.getElementById('input-troca-foto').style.display = 'none';
        document.getElementById('nova-foto-input').value = '';
        mostrarToast('Seu retrato foi atualizado no reino.', 'sucesso', 'Foto alterada');
    } catch (error) {
        mostrarToast('Esse link não parece ser de uma imagem válida.', 'erro', 'Erro na imagem');
    }
}

function validarUrlDeImagem(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('imagem inválida'));
        img.src = url;
    });
}

// Estado em memória: lista de fichas da conta logada e qual está ativa.
// É atualizado em tempo real pelos listeners abaixo.
let fichasDoUsuario = [];
let fichaAtivaId = null;

function escutarDadosUsuario(uid) {
    // Observa o documento raiz do usuário: guarda apenas qual ficha está ativa.
    onSnapshot(doc(db, "usuarios", uid), (docSnap) => {
        if (docSnap.exists()) {
            const dados = docSnap.data();
            fichaAtivaId = dados.fichaAtivaId || null;
            atualizarPerfilComFichaAtiva();
            renderizarListaDeFichas();
        }
    });

    // Observa a subcoleção de fichas dessa conta em tempo real.
    onSnapshot(collection(db, "usuarios", uid, "fichas"), (querySnapshot) => {
        fichasDoUsuario = [];
        querySnapshot.forEach((fichaSnap) => {
            fichasDoUsuario.push({ id: fichaSnap.id, ...fichaSnap.data() });
        });
        atualizarPerfilComFichaAtiva();
        renderizarListaDeFichas();
    });
}

// Pega o objeto da ficha que está marcada como ativa, ou null se não houver nenhuma.
function obterFichaAtiva() {
    if (!fichaAtivaId) return null;
    return fichasDoUsuario.find(f => f.id === fichaAtivaId) || null;
}

// Atualiza o cabeçalho (perfil, saldo, avatar) com os dados da ficha ativa.
function atualizarPerfilComFichaAtiva() {
    const ficha = obterFichaAtiva();

    if (!ficha) {
        document.getElementById('coins').innerText = '0';
        document.getElementById('nome-perfil').innerText = 'Nenhuma ficha ativa';
        document.getElementById('avatar-perfil').src = AVATAR_PADRAO;
        document.getElementById('avatar-flutuante').src = AVATAR_PADRAO;
        document.getElementById('menu-conta-nome').innerText = 'Sem personagem';
        renderizarInventario([]);
        return;
    }

    document.getElementById('coins').innerText = ficha.moedas;
    document.getElementById('nome-perfil').innerText = 'Personagem: ' + (ficha.nome || 'Sem Nome');
    document.getElementById('avatar-perfil').src = ficha.foto || AVATAR_PADRAO;
    document.getElementById('avatar-flutuante').src = ficha.foto || AVATAR_PADRAO;
    document.getElementById('menu-conta-nome').innerText = ficha.nome || 'Sem Nome';

    renderizarInventario(ficha.inventario || []);
}

// =========================================
// SISTEMA DE FICHAS (criar, editar, listar, selecionar ativa, ajustar vida/defesa)
// =========================================

// Popula o <select> de classes de acordo com a origem (Nobre/Plebeu) escolhida
function atualizarClassesDisponiveis() {
    const origem = document.getElementById('ficha-origem').value;
    const selectClasse = document.getElementById('ficha-classe');
    const classes = classesPorOrigem[origem] || [];

    selectClasse.innerHTML = classes.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Abre o formulário de criação de uma ficha nova (em branco)
function abrirFormularioFicha(fichaIdParaEditar) {
    document.getElementById('formulario-ficha-overlay').style.display = 'flex';

    if (fichaIdParaEditar) {
        const ficha = fichasDoUsuario.find(f => f.id === fichaIdParaEditar);
        if (!ficha) return;

        document.getElementById('formulario-ficha-titulo').innerText = 'Editar Personagem';
        document.getElementById('formulario-ficha-overlay').dataset.editandoId = fichaIdParaEditar;

        document.getElementById('ficha-nome').value = ficha.nome || '';
        document.getElementById('ficha-casa').value = ficha.casa || 'Sem Casa';
        document.getElementById('ficha-origem').value = ficha.origem || 'Plebeu';
        atualizarClassesDisponiveis();
        document.getElementById('ficha-classe').value = ficha.classe || '';
        document.getElementById('ficha-idade').value = ficha.idade || '';
        document.getElementById('ficha-genero').value = ficha.genero || '';
        document.getElementById('ficha-altura').value = ficha.altura || '';
        document.getElementById('ficha-foto').value = ficha.foto || '';
        document.getElementById('ficha-tema').value = ficha.tema || 'theme-classic';
        document.getElementById('ficha-sobre').value = ficha.sobre || '';
    } else {
        document.getElementById('formulario-ficha-titulo').innerText = 'Criar Novo Personagem';
        delete document.getElementById('formulario-ficha-overlay').dataset.editandoId;

        document.getElementById('ficha-nome').value = '';
        document.getElementById('ficha-casa').value = 'Sem Casa';
        document.getElementById('ficha-origem').value = 'Plebeu';
        atualizarClassesDisponiveis();
        document.getElementById('ficha-idade').value = '';
        document.getElementById('ficha-genero').value = '';
        document.getElementById('ficha-altura').value = '';
        document.getElementById('ficha-foto').value = '';
        document.getElementById('ficha-tema').value = 'theme-classic';
        document.getElementById('ficha-sobre').value = '';
    }
}

function fecharFormularioFicha() {
    document.getElementById('formulario-ficha-overlay').style.display = 'none';
}

// Salva a ficha (cria nova ou atualiza existente) no Firestore
async function salvarFicha() {
    const nome = document.getElementById('ficha-nome').value.trim();
    const casa = document.getElementById('ficha-casa').value;
    const origem = document.getElementById('ficha-origem').value;
    const classe = document.getElementById('ficha-classe').value;
    const idade = document.getElementById('ficha-idade').value;
    const genero = document.getElementById('ficha-genero').value;
    const altura = document.getElementById('ficha-altura').value;
    const foto = document.getElementById('ficha-foto').value.trim();
    const tema = document.getElementById('ficha-tema').value;
    const sobre = document.getElementById('ficha-sobre').value;

    if (!nome) return mostrarToast('Dê um nome ao seu personagem.', 'erro', 'Nome obrigatório');
    if (!classe) return mostrarToast('Escolha uma classe para o personagem.', 'erro', 'Classe obrigatória');

    const editandoId = document.getElementById('formulario-ficha-overlay').dataset.editandoId;

    try {
        if (editandoId) {
            // Edição: mantém vida atual, moedas, inventário e equipamento já existentes.
            // Só recalcula vidaMaxima/defesaBase se a classe ou origem mudou.
            const fichaAtual = fichasDoUsuario.find(f => f.id === editandoId);
            const statusRecalculado = calcularStatusBase(origem, classe);
            const mudouClasseOuOrigem = fichaAtual.classe !== classe || fichaAtual.origem !== origem;

            const dadosAtualizados = {
                nome, casa, origem, classe, idade, genero, altura, foto, tema, sobre,
                defesaBase: statusRecalculado.defesaBase,
                vidaMaxima: statusRecalculado.vidaMaxima,
            };

            // Se a classe/origem mudou, a vida atual é ajustada proporcionalmente
            // para não ultrapassar a nova vida máxima nem ficar negativa.
            if (mudouClasseOuOrigem) {
                dadosAtualizados.vidaAtual = Math.min(fichaAtual.vidaAtual ?? statusRecalculado.vidaMaxima, statusRecalculado.vidaMaxima);
            }

            await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", editandoId), dadosAtualizados);
            mostrarToast(`${nome} foi atualizado.`, 'sucesso', 'Ficha salva');
        } else {
            // Criação de uma ficha nova
            const status = calcularStatusBase(origem, classe);
            const novaFichaRef = doc(collection(db, "usuarios", usuarioAtual.uid, "fichas"));

            await setDoc(novaFichaRef, {
                nome, casa, origem, classe, idade, genero, altura, foto, tema, sobre,
                vidaMaxima: status.vidaMaxima,
                vidaAtual: status.vidaMaxima,
                defesaBase: status.defesaBase,
                moedas: moedasIniciaisPorClasse[classe] || 1000,
                inventario: [],
                equipado: { arma: null, armadura: null }
            });

            mostrarToast(`${nome} foi forjado e está pronto para a aventura.`, 'sucesso', 'Personagem criado');
        }

        fecharFormularioFicha();
    } catch (error) {
        mostrarToast('Não foi possível salvar a ficha. Tente novamente.', 'erro', 'Erro');
        console.error(error);
    }
}

// Define qual ficha está ativa (a que vai comprar/vender/jogar no momento)
async function selecionarFichaAtiva(fichaId) {
    try {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid), { fichaAtivaId: fichaId });
        const ficha = fichasDoUsuario.find(f => f.id === fichaId);
        mostrarToast(`Agora jogando como ${ficha ? ficha.nome : 'personagem selecionado'}.`, 'sucesso', 'Ficha ativa');
    } catch (error) {
        mostrarToast('Não foi possível trocar de ficha ativa.', 'erro', 'Erro');
        console.error(error);
    }
}

async function excluirFicha(fichaId, nomeFicha) {
    const confirmado = await mostrarConfirmacao(
        `Excluir permanentemente <strong>${nomeFicha}</strong>? Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaId));

        // Se a ficha excluída era a ativa, escolhe automaticamente outra (ou nenhuma)
        if (fichaAtivaId === fichaId) {
            const restantes = fichasDoUsuario.filter(f => f.id !== fichaId);
            const novaAtiva = restantes.length > 0 ? restantes[0].id : null;
            await updateDoc(doc(db, "usuarios", usuarioAtual.uid), { fichaAtivaId: novaAtiva });
        }

        mostrarToast(`${nomeFicha} foi removido.`, 'sucesso', 'Ficha excluída');
    } catch (error) {
        mostrarToast('Não foi possível excluir a ficha.', 'erro', 'Erro');
        console.error(error);
    }
}

// Ajusta a Vida Atual de QUALQUER ficha da conta (não só a ativa) — permite ao
// jogador administrar dano/cura em qualquer um dos seus personagens a qualquer momento.
async function ajustarVidaDeFicha(fichaId, quantidade) {
    const ficha = fichasDoUsuario.find(f => f.id === fichaId);
    if (!ficha) return;

    const novaVida = Math.max(0, Math.min(ficha.vidaMaxima, (ficha.vidaAtual ?? ficha.vidaMaxima) + quantidade));

    try {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaId), { vidaAtual: novaVida });
    } catch (error) {
        mostrarToast('Não foi possível atualizar a vida.', 'erro', 'Erro');
        console.error(error);
    }
}

// Ajusta a Vida Atual da ficha ativa manualmente (dano ou cura administrados pelo jogador)
async function ajustarVidaFichaAtiva(quantidade) {
    const ficha = obterFichaAtiva();
    if (!ficha) return;

    const novaVida = Math.max(0, Math.min(ficha.vidaMaxima, (ficha.vidaAtual ?? ficha.vidaMaxima) + quantidade));

    try {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId), { vidaAtual: novaVida });
    } catch (error) {
        mostrarToast('Não foi possível atualizar a vida.', 'erro', 'Erro');
        console.error(error);
    }
}

// Renderiza os cards de todas as fichas da conta na página "Minhas Fichas"
function renderizarListaDeFichas() {
    const container = document.getElementById('lista-fichas');
    if (!container) return;

    if (fichasDoUsuario.length === 0) {
        container.innerHTML = '<p class="mochila-vazia">Você ainda não forjou nenhum personagem. Crie sua primeira ficha!</p>';
        return;
    }

    container.innerHTML = '';
    fichasDoUsuario.forEach(ficha => {
        const ehAtiva = ficha.id === fichaAtivaId;
        const vidaAtual = ficha.vidaAtual ?? ficha.vidaMaxima;
        const defesaTotal = calcularDefesaTotal(ficha);
        const percentualVida = Math.round((vidaAtual / ficha.vidaMaxima) * 100);

        container.innerHTML += `
            <div class="card-ficha ${ehAtiva ? 'ficha-ativa' : ''}">
                <div class="card-ficha-topo">
                    <img class="avatar-ficha" src="${ficha.foto || AVATAR_PADRAO}" alt="${ficha.nome}">
                    <div class="card-ficha-info">
                        <strong>${ficha.nome}</strong>
                        <span class="card-ficha-classe">${ficha.classe} · ${ficha.casa}</span>
                    </div>
                    ${ehAtiva ? '<span class="selo-ativa">EM JOGO</span>' : ''}
                </div>

                <div class="barra-status">
                    <div class="barra-status-label">
                        <span>Vida</span>
                        <span>${vidaAtual} / ${ficha.vidaMaxima}</span>
                    </div>
                    <div class="barra-fundo">
                        <div class="barra-preenchimento barra-vida" style="width:${percentualVida}%"></div>
                    </div>
                    <div class="controles-vida">
                        <button class="btn-vida-ajuste dano" onclick="ajustarVidaDeFicha('${ficha.id}', -1)">-1</button>
                        <button class="btn-vida-ajuste dano" onclick="ajustarVidaDeFicha('${ficha.id}', -5)">-5</button>
                        <button class="btn-vida-ajuste cura" onclick="ajustarVidaDeFicha('${ficha.id}', 5)">+5</button>
                        <button class="btn-vida-ajuste cura" onclick="ajustarVidaDeFicha('${ficha.id}', 1)">+1</button>
                    </div>
                </div>

                <div class="card-ficha-stats">
                    <span>🛡️ Defesa: <strong>${defesaTotal}</strong></span>
                    <span>💰 ${ficha.moedas} ic's</span>
                </div>

                <div class="card-ficha-botoes">
                    ${!ehAtiva ? `<button onclick="selecionarFichaAtiva('${ficha.id}')">Jogar com esta</button>` : ''}
                    <button class="btn-secondary" onclick="abrirFormularioFicha('${ficha.id}')">Editar</button>
                    <button class="btn-vender" onclick="excluirFicha('${ficha.id}', '${ficha.nome}')">Excluir</button>
                </div>
            </div>
        `;
    });
}

// Calcula a Defesa total da ficha: base + bônus da armadura equipada (se houver)
function calcularDefesaTotal(ficha) {
    let total = ficha.defesaBase || 0;
    const idArmaduraEquipada = ficha.equipado?.armadura;
    if (idArmaduraEquipada) {
        const itemArmadura = (ficha.inventario || []).find(i => i.idUnico === idArmaduraEquipada);
        if (itemArmadura?.mecanica?.tipo === 'armadura') {
            total += itemArmadura.mecanica.defesa || 0;
        }
    }
    return total;
}

// 4. FUNÇÕES DE RENDERIZAÇÃO (INTERFACE)
function filtrarItens(tipoSelecionado) {
    const vitrine = document.getElementById('vitrine');
    vitrine.innerHTML = '';
    let filtrados = tipoSelecionado === 'todos' ? itensMercado : itensMercado.filter(i => i.tipo === tipoSelecionado);

    // Marca visualmente qual botão de filtro está ativo
    document.querySelectorAll('.filtros button').forEach(btn => btn.classList.remove('ativo'));
    if (event && event.target) {
        event.target.classList.add('ativo');
    }

    filtrados.forEach(item => {
        vitrine.innerHTML += `
            <div class="card ${item.raridade}" data-raridade="${item.raridade}">
              <div class="frame-imagem">
                  <div class="card-imagem">
                      <img src="${item.imagem}" alt="${item.nome}">
                  </div>
                  <span class="canto tl"></span>
                  <span class="canto tr"></span>
                  <span class="canto bl"></span>
                  <span class="canto br"></span>
              </div>
                <h3>${item.nome}</h3>
                <p class="efeito">${item.efeito}</p>
                <span class="preco">${item.preco} ic's</span>
                <!-- Chamando o nome que exportamos para o window -->
                <button onclick="comprarItem('${item.nome}', ${item.preco}, this)">Comprar</button>
            </div>
        `;
    });
}

function renderizarInventario(itens) {
    const section = document.getElementById('lista-inventario');

    atualizarBadgeMochila(itens.length);

    if (itens.length === 0) {
        section.innerHTML = '<p class="mochila-vazia">Sua mochila está vazia, aventureiro.</p>';
        return;
    }

    const nomeRaridade = {
        comum: 'comum',
        incomum: 'incomum',
        raro: 'raro',
        epico: 'épico',
        lendario: 'lendário'
    };

    const ficha = obterFichaAtiva();
    const equipado = ficha?.equipado || {};

    section.innerHTML = '';
    itens.forEach(item => {
        const valorVenda = Math.floor(item.preco * 0.7);
        const mecanica = item.mecanica || { tipo: 'nenhum' };

        // Monta o botão de ação extra (equipar/desequipar ou usar), de acordo com o tipo do item
        let botaoAcao = '';
        if (mecanica.tipo === 'arma') {
            const estaEquipada = equipado.arma === item.idUnico;
            botaoAcao = estaEquipada
                ? `<button class="btn-equipar equipado" onclick="desequiparItem('arma')">✓ Equipada</button>`
                : `<button class="btn-equipar" onclick="equiparItem('arma', ${item.idUnico})">Equipar</button>`;
        } else if (mecanica.tipo === 'armadura') {
            const estaEquipada = equipado.armadura === item.idUnico;
            botaoAcao = estaEquipada
                ? `<button class="btn-equipar equipado" onclick="desequiparItem('armadura')">✓ Equipada</button>`
                : `<button class="btn-equipar" onclick="equiparItem('armadura', ${item.idUnico})">Equipar</button>`;
        } else if (mecanica.tipo === 'cura' || mecanica.tipo === 'vidaMaxima') {
            botaoAcao = `<button class="btn-usar" onclick="usarItem(${item.idUnico})">Usar</button>`;
        }

        section.innerHTML += `
            <div class="card-inventario ${item.raridade}">
                <div class="frame-imagem">
                    <div class="card-imagem">
                        <img src="${item.imagem}" alt="${item.nome}">
                    </div>
                    <span class="canto tl"></span>
                    <span class="canto tr"></span>
                    <span class="canto bl"></span>
                    <span class="canto br"></span>
                </div>
                <div class="info-corpo">
                    <span class="tipo-raridade">${item.tipo} · ${nomeRaridade[item.raridade] || item.raridade}</span>
                    <strong>${item.nome}</strong>
                    <p class="efeito">${item.efeito}</p>
                    <p class="desc">${item.desc || ''}</p>
                    <div class="rodape-inventario">
                        <span class="preco-original">Comprado por <span>${item.preco} ic's</span></span>
                    </div>
                    ${botaoAcao}
                    <!-- Importante: preco vem do objeto item -->
                    <button class="btn-vender" onclick="venderItem(${item.idUnico}, ${item.preco}, '${item.nome}', this)">Vender (${valorVenda} ic's)</button>
                </div>
            </div>
        `;
    });
}

// Equipa uma arma ou armadura na ficha ativa (1 de cada por vez)
async function equiparItem(slot, idUnico) {
    const ficha = obterFichaAtiva();
    if (!ficha) return;

    try {
        const novoEquipado = { ...(ficha.equipado || {}), [slot]: idUnico };
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId), { equipado: novoEquipado });
        mostrarToast('Item equipado.', 'sucesso', slot === 'arma' ? 'Arma equipada' : 'Armadura equipada');
    } catch (error) {
        mostrarToast('Não foi possível equipar o item.', 'erro', 'Erro');
        console.error(error);
    }
}

async function desequiparItem(slot) {
    const ficha = obterFichaAtiva();
    if (!ficha) return;

    try {
        const novoEquipado = { ...(ficha.equipado || {}), [slot]: null };
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId), { equipado: novoEquipado });
        mostrarToast('Item removido.', 'sucesso', 'Desequipado');
    } catch (error) {
        mostrarToast('Não foi possível desequipar o item.', 'erro', 'Erro');
        console.error(error);
    }
}

// Usa um item consumível com efeito mecânico: cura Vida Atual ou aumenta Vida Máxima.
// O item é removido da mochila ao ser usado.
async function usarItem(idUnico) {
    const ficha = obterFichaAtiva();
    if (!ficha) return;

    const item = (ficha.inventario || []).find(i => i.idUnico === idUnico);
    if (!item) return;

    const mecanica = item.mecanica || {};
    let mensagem = '';
    const dadosAtualizados = {
        inventario: ficha.inventario.filter(i => i.idUnico !== idUnico)
    };

    if (mecanica.tipo === 'cura') {
        const vidaAtualAntes = ficha.vidaAtual ?? ficha.vidaMaxima;
        const novaVida = Math.min(ficha.vidaMaxima, vidaAtualAntes + mecanica.vida);
        dadosAtualizados.vidaAtual = novaVida;
        mensagem = `${item.nome} curou ${novaVida - vidaAtualAntes} de vida.`;
    } else if (mecanica.tipo === 'vidaMaxima') {
        const novaVidaMaxima = (ficha.vidaMaxima || 0) + mecanica.valor;
        dadosAtualizados.vidaMaxima = novaVidaMaxima;
        dadosAtualizados.vidaAtual = (ficha.vidaAtual ?? ficha.vidaMaxima) + mecanica.valor;
        mensagem = `${item.nome} aumentou sua Vida Máxima em ${mecanica.valor} permanentemente.`;
    } else {
        return; // item sem efeito mecânico, não deveria ter chegado aqui
    }

    try {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId), dadosAtualizados);
        mostrarToast(mensagem, 'sucesso', 'Item usado');
    } catch (error) {
        mostrarToast('Não foi possível usar o item.', 'erro', 'Erro');
        console.error(error);
    }
}

// 5. LÓGICA DE COMPRA E VENDA (BANCO DE DADOS)
const LIMITE_CONFIRMACAO_COMPRA = 1000; // itens acima desse preço pedem confirmação

async function comprarItemNoFirebase(nomeItem, precoItem, botao) {
    if (!usuarioAtual) {
        mostrarToast('Você precisa entrar no reino antes de negociar.', 'erro', 'Acesso negado');
        return;
    }

    if (!fichaAtivaId) {
        mostrarToast('Crie ou selecione uma ficha antes de comprar itens.', 'erro', 'Nenhuma ficha ativa');
        return;
    }

    if (precoItem >= LIMITE_CONFIRMACAO_COMPRA) {
        const confirmado = await mostrarConfirmacao(
            `Comprar <strong>${nomeItem}</strong> por <strong>${precoItem} ic's</strong>?`
        );
        if (!confirmado) return;
    }

    if (botao) { botao.classList.add('carregando'); botao.disabled = true; }

    try {
        const fichaRef = doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId);
        const fichaSnap = await getDoc(fichaRef);
        const dados = fichaSnap.data();

        if (dados.moedas >= precoItem) {
            const itemDados = itensMercado.find(i => i.nome === nomeItem);
            const novoInventario = [...(dados.inventario || []), { ...itemDados, idUnico: Date.now() }];
            await updateDoc(fichaRef, { moedas: dados.moedas - precoItem, inventario: novoInventario });
            mostrarToast(`${nomeItem} foi guardado em sua mochila.`, 'sucesso', 'Negócio fechado');
        } else {
            mostrarToast('Suas moedas não são suficientes para esse item.', 'erro', 'Sem moedas');
        }
    } catch (error) {
        mostrarToast('Não foi possível concluir a compra. Tente novamente.', 'erro', 'Erro');
        console.error(error);
    } finally {
        if (botao) { botao.classList.remove('carregando'); botao.disabled = false; }
    }
}

async function venderItemNoFirebase(idUnico, precoOriginal, nomeItem, botao) {
    if (!fichaAtivaId) {
        mostrarToast('Nenhuma ficha ativa selecionada.', 'erro', 'Erro');
        return;
    }

    const valorVenda = Math.floor(precoOriginal * 0.7);

    const confirmado = await mostrarConfirmacao(
        `Vender <strong>${nomeItem || 'este item'}</strong> por <strong>${valorVenda} ic's</strong>?`
    );
    if (!confirmado) return;

    if (botao) { botao.classList.add('carregando'); botao.disabled = true; }

    try {
        const fichaRef = doc(db, "usuarios", usuarioAtual.uid, "fichas", fichaAtivaId);
        const fichaSnap = await getDoc(fichaRef);
        const dados = fichaSnap.data();

        // Se o item vendido estiver equipado, desequipa automaticamente
        const equipado = { ...(dados.equipado || {}) };
        if (equipado.arma === idUnico) equipado.arma = null;
        if (equipado.armadura === idUnico) equipado.armadura = null;

        const novoInventario = dados.inventario.filter(i => i.idUnico !== idUnico);
        await updateDoc(fichaRef, { moedas: dados.moedas + valorVenda, inventario: novoInventario, equipado });
        mostrarToast(`Você recebeu ${valorVenda} ic's pela venda.`, 'sucesso', 'Item vendido');
    } catch (error) {
        mostrarToast('Não foi possível concluir a venda. Tente novamente.', 'erro', 'Erro');
        console.error(error);
    } finally {
        if (botao) { botao.classList.remove('carregando'); botao.disabled = false; }
    }
}

async function fazerCadastro() {
    const nomePersonagem = document.getElementById('login-nome').value; // Captura o nome
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const botao = event ? event.target : null;

    if (!nomePersonagem) return mostrarToast('Escolha um nome para seu personagem.', 'erro', 'Nome obrigatório');

    if (botao) { botao.classList.add('carregando'); botao.disabled = true; }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // Cria a primeira ficha do jogador com uma classe inicial padrão
        // (Guerreiro / Plebeu). O jogador pode editá-la ou criar outras depois.
        const origemInicial = "Plebeu";
        const classeInicial = "Guerreiros";
        const status = calcularStatusBase(origemInicial, classeInicial);

        const novaFichaRef = doc(collection(db, "usuarios", user.uid, "fichas"));
        await setDoc(novaFichaRef, {
            nome: nomePersonagem,
            casa: "Sem Casa",
            origem: origemInicial,
            classe: classeInicial,
            idade: "",
            genero: "",
            altura: "",
            foto: "",
            tema: "theme-classic",
            sobre: "",
            vidaMaxima: status.vidaMaxima,
            vidaAtual: status.vidaMaxima,
            defesaBase: status.defesaBase,
            moedas: moedasIniciaisPorClasse[classeInicial] || 1000,
            inventario: [],
            equipado: { arma: null, armadura: null }
        });

        // Cria o documento raiz do usuário já apontando para essa primeira ficha
        await setDoc(doc(db, "usuarios", user.uid), {
            fichaAtivaId: novaFichaRef.id
        });

        mostrarToast(`Cavaleiro ${nomePersonagem} foi registrado no reino.`, 'sucesso', 'Bem-vindo');
    } catch (error) {
        mostrarToast(traduzirErroFirebase(error), 'erro', 'Erro ao cadastrar');
    } finally {
        if (botao) { botao.classList.remove('carregando'); botao.disabled = false; }
    }
}

async function fazerLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const botao = event ? event.target : null;

    if (botao) { botao.classList.add('carregando'); botao.disabled = true; }

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        // A tela de login é escondida automaticamente pelo onAuthStateChanged
        mostrarToast('Que seus dias sejam longos e prósperos.', 'sucesso', 'Bem-vindo de volta');
    } catch (error) {
        mostrarToast(traduzirErroFirebase(error), 'erro', 'Erro ao entrar');
    } finally {
        if (botao) { botao.classList.remove('carregando'); botao.disabled = false; }
    }
}

// Traduz os erros mais comuns do Firebase Auth para mensagens legíveis
function traduzirErroFirebase(error) {
    const codigo = error?.code || '';
    const mapa = {
        'auth/invalid-email': 'O e-mail informado não é válido.',
        'auth/user-not-found': 'Não há nenhum cavaleiro com esse e-mail.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/email-already-in-use': 'Já existe um cadastro com esse e-mail.',
        'auth/weak-password': 'A senha precisa ter ao menos 6 caracteres.',
    };
    return mapa[codigo] || 'Algo deu errado. Tente novamente em breve.';
}

// --- FUNÇÕES DE MENSAGEM GLOBAL ---
async function enviarAviso() {
    const texto = document.getElementById('input-aviso').value;
    await setDoc(doc(db, "configuracao", "global"), { aviso: texto });
    document.getElementById('input-aviso').value = '';
}

async function limparAviso() {
    await setDoc(doc(db, "configuracao", "global"), { aviso: "" });
}

function escutarAvisoGlobal() {
    onSnapshot(doc(db, "configuracao", "global"), (docSnap) => {
        const banner = document.getElementById('banner-global');
        if (docSnap.exists() && docSnap.data().aviso) {
            banner.style.display = 'block';
            document.getElementById('texto-aviso').innerText = "📢 AVISO DO REINO: " + docSnap.data().aviso;
        } else {
            banner.style.display = 'none';
        }
    });
}

// --- FUNÇÕES DE CONTROLE DE JOGADORES (operam sobre a FICHA, não a conta) ---
async function ajustarMoedas(donoUid, fichaId, quantidade) {
    const fichaRef = doc(db, "usuarios", donoUid, "fichas", fichaId);
    const snap = await getDoc(fichaRef);
    const moedasAtuais = snap.data().moedas || 0;
    await updateDoc(fichaRef, { moedas: moedasAtuais + quantidade });
}

async function limparInventario(donoUid, fichaId) {
    const confirmado = await mostrarConfirmacao('Deseja realmente limpar a mochila desta ficha? (Morte do Personagem)');
    if (!confirmado) return;
    await updateDoc(doc(db, "usuarios", donoUid, "fichas", fichaId), { inventario: [], equipado: { arma: null, armadura: null } });
}

// Carrega todas as fichas de todos os jogadores em tempo real (collection group:
// busca a subcoleção "fichas" através de TODAS as contas de uma vez).
function monitorarComunidade() {
    onSnapshot(collectionGroup(db, "fichas"), (querySnapshot) => {
        const mural = document.getElementById('lista-comunidade');
        mural.innerHTML = '';

        if (querySnapshot.empty) {
            mural.innerHTML = '<p class="mochila-vazia">Nenhum explorador forjou sua lenda ainda.</p>';
            return;
        }

        querySnapshot.forEach((fichaSnap) => {
            const ficha = fichaSnap.data();
            const fichaId = fichaSnap.id;
            // O "dono" da ficha é o documento avô na hierarquia usuarios/{uid}/fichas/{fichaId}
            const donoUid = fichaSnap.ref.parent.parent.id;

            const botoesMestre = (usuarioAtual && usuarioAtual.uid === ADMIN_UID) ? `
                <div class="controles-admin">
                    <button class="btn-admin" onclick="ajustarMoedas('${donoUid}', '${fichaId}', 100)">+100</button>
                    <button class="btn-admin" onclick="ajustarMoedas('${donoUid}', '${fichaId}', -100)">-100</button>
                    <button class="btn-admin btn-vender" onclick="limparInventario('${donoUid}', '${fichaId}')">💀 Limpar</button>
                </div>
            ` : '';

            const itensHTML = ficha.inventario?.map(i => `<span class="item-tag ${i.raridade}">${i.nome}</span>`).join('') || "Vazia";
            const vidaAtual = ficha.vidaAtual ?? ficha.vidaMaxima ?? 0;
            const defesaTotal = calcularDefesaTotal(ficha);

            mural.innerHTML += `
                <div class="player-card">
                    <div class="player-card-header">
                        <img class="avatar-mural" src="${ficha.foto || AVATAR_PADRAO}" alt="Avatar de ${ficha.nome || 'jogador'}">
                        <h3>${ficha.nome || 'Desconhecido'} <span class="tag-classe-mural">${ficha.classe || ''}</span></h3>
                    </div>
                    <div class="player-info">
                        ❤️ ${vidaAtual}/${ficha.vidaMaxima || 0} · 🛡️ ${defesaTotal} · 💰 ${ficha.moedas || 0} ic's
                        ${botoesMestre}
                    </div>
                    <div class="player-backpack">${itensHTML}</div>
                </div>
            `;
        });
    });
}

try {
    monitorarComunidade();
} catch (erroComunidade) {
    console.error("Erro ao carregar o mural da comunidade:", erroComunidade);
}

// 6. TORNAR FUNÇÕES GLOBAIS (PARA O HTML ENXERGAR)
// No final do script.js, adicione estas linhas:
// O nome da esquerda é como o HTML chama, o da direita é o nome real da função no JS
window.fazerLogin = fazerLogin;
window.fazerCadastro = fazerCadastro;
window.comprarItem = comprarItemNoFirebase; // Corrigido
window.venderItem = venderItemNoFirebase;   // Corrigido
window.mostrarTrocaNome = mostrarTrocaNome;
window.salvarNovoNome = salvarNovoNome;
window.mostrarTrocaFoto = mostrarTrocaFoto;
window.salvarNovaFoto = salvarNovaFoto;
window.alternarMenuConta = alternarMenuConta;
window.mostrarPagina = mostrarPagina;
window.trocarDeConta = trocarDeConta;
window.enviarAviso = enviarAviso;
window.limparAviso = limparAviso;
window.ajustarMoedas = ajustarMoedas;
window.limparInventario = limparInventario;
window.atualizarClassesDisponiveis = atualizarClassesDisponiveis;
window.abrirFormularioFicha = abrirFormularioFicha;
window.fecharFormularioFicha = fecharFormularioFicha;
window.salvarFicha = salvarFicha;
window.selecionarFichaAtiva = selecionarFichaAtiva;
window.excluirFicha = excluirFicha;
window.ajustarVidaFichaAtiva = ajustarVidaFichaAtiva;
window.ajustarVidaDeFicha = ajustarVidaDeFicha;
window.equiparItem = equiparItem;
window.desequiparItem = desequiparItem;
window.usarItem = usarItem;