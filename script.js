import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs } from "firebase/firestore";

// Abaixo daqui, verifique se NÃO existe nenhuma linha como:
// const getAuth = ... ou outro import { getAuth } ...

// ... restante das configurações (firebaseConfig)

// 1. COLOQUE SEUS DADOS DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "AIzaSyDaEGg2wS3N47nxeOrJRHV0-4Cd41MLIaA",
    authDomain: "the-fallen-throne.firebaseapp.com",
    projectId: "the-fallen-throne",
    storageBucket: "the-fallen-throne.firebasestorage.app",
    messagingSenderId: "136052504846",
    appId: "1:136052504846:web:a705dd5763a644c9643f5f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_UID = "MQZd3bjnchaop9y8tRQvLqNBNaz1"; // Você descobre esse ID no console do Firebase após logar

// 2. SUA LISTA DE ITENS (MANTIDA)
const itensMercado = [
    { nome: "Adaga de Aço Comum", 
      tipo: "Arma",
      raridade: "comum",
      preco: 60,
      imagem: "https://png.pngtree.com/png-vector/20231115/ourmid/pngtree-ancient-roman-dagger-knife-png-image_10592942.png", // Link da imagem
      efeito: "1d4 + Agilidade",
      desc: "Aço barato." },

    { nome: "Espada de Aço de Castelo",
      tipo: "Arma",
      raridade: "incomum",
      preco: 400,
      imagem: "https://acdn-us.mitiendanube.com/stores/007/070/236/products/bxg01-1-18d15693c0cec782e917684061205550-1024-1024.webp", // Link da imagem
      efeito: "1d8 + Força",
      desc: "Equilibrada." },

    { nome: "Lança de Vidro de Dragão",
      tipo: "Arma",
      raridade: "epico",
      preco: 2500,
      imagem: "https://gbf.wiki/images/thumb/2/23/Weapon_b_1020201100.png/462px-Weapon_b_1020201100.png", // Link da imagem
      efeito: "1d10 + Agi",
      desc: "Obsidiana pura." },

    { nome: "Espada de Aço Valiriano",
      tipo: "Arma",
      raridade: "lendario",
      preco: 9500,
      imagem: "https://cdna.artstation.com/p/assets/images/images/029/004/974/large/andrew-demel-darkswordcolor1.jpg?1596159620", // Link da imagem
      efeito: "2d6 + Força",
      desc: "Relíquia ancestral." },

    { nome: "Gibão de Couro Batido",
        tipo: "Armadura",
        raridade: "comum",
        preco: 120,
        imagem: "https://i.etsystatic.com/60627043/r/il/48c638/7200589820/il_340x270.7200589820_mzji.jpg", // Link da imagem
        efeito: "+2 Defesa",
        desc: "Leve." },

    { nome: "Cota de Malha",
      tipo: "Armadura",
      raridade: "incomum",
      preco: 600,
      imagem: "https://loxwoodjoust.co.uk/wp-content/uploads/2022/07/KnightinChainmail_adobe1280x853-1024x682.jpg", // Link da imagem
      efeito: "+4 Defesa | -1 Agi",
      desc: "Proteção pesada." },

    { nome: "Leite de Papoula",
      tipo: "Consumível",
      raridade: "raro",
      preco: 150,
      imagem: "https://awoiaf.westeros.org/images/thumb/9/99/Milk_of_the_poppy.jpg/350px-Milk_of_the_poppy.jpg", // Link da imagem
      efeito: "Cura 1d10 Vida",
      desc: "Analgésico." },

    { 
        nome: "Machado de Guerra", 
        tipo: "Arma", 
        raridade: "raro", 
        preco: 850, 
        imagem: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPadPXU7wzPrE2Tkpa0FoTmjtWo3dQB0n-5A&s",
        efeito: "1d10 + Força (Pesada)", 
        desc: "Capaz de partir escudos de madeira com facilidade." 
    },

    { 
        nome: "Arco de Madeira de Represeiro", 
        tipo: "Arma", 
        raridade: "epico", 
        preco: 2200, 
        imagem: "https://cdnb.artstation.com/p/assets/images/images/044/887/555/large/mike-kokkinos-screenshot1.jpg?1641403101",
        efeito: "1d8 + Agi (Crítico 18-20)", 
        desc: "Madeira sagrada do Norte, extremamente flexível." 
    },

    { 
        nome: "Irmã Sombria (Réplica)", 
        tipo: "Arma", 
        raridade: "lendario", 
        preco: 9500, 
        imagem: "https://cdnb.artstation.com/p/assets/covers/images/000/896/417/large/raphael-lima-dark-sister-01.jpg?1435590877",
        efeito: "2d6 + Força + Sangramento", 
        desc: "Inspirada na espada de Visenya Targaryen." 
    },

    { 
        nome: "Escudo com Brasão", 
        tipo: "Armadura", 
        raridade: "raro", 
        preco: 900, 
        imagem: "https://thumbs.dreamstime.com/b/medieval-crusader%C3%A2%E2%82%AC%E2%84%A2s-metal-shield-isolated-white-large-medieval-crusader-s-metal-shield-isolated-white-background-359899733.jpg",
        efeito: "+3 Defesa (Reação)", 
        desc: "Um escudo reforçado com as cores da sua Casa." 
    },

    { 
        nome: "Armadura de Placas Completa", 
        tipo: "Armadura", 
        raridade: "epico", 
        preco: 3500, 
        imagem: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCHd4S0QFy6UFGXUjlUrUVPJrZxgMlLmpdtw&s",
        efeito: "+10 Defesa | Desvantagem em Furtividade e -2 Agi", 
        desc: "A defesa máxima para um campeão." 
    },

    { 
        nome: "Fogovivo (Pote)", 
        tipo: "Consumível", 
        raridade: "epico", 
        preco: 1800, 
        imagem: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSgvGhQ8nZSYcnLr-dUTwdJF7a4D1igVSvg3w&s",
        efeito: "4d6 Dano de Área (Fogo)", 
        desc: "A substância perigosa dos alquimistas." 
    },

    { 
        nome: "Vinho da Árvore", 
        tipo: "Consumível", 
        raridade: "raro", 
        preco: 250, 
        imagem: "https://i.pinimg.com/474x/a9/da/43/a9da43d7650fda383714b389f7277877.jpg",
        efeito: "Recupera Fôlego, podendo fazer duas ações em um turno.", 
        desc: "O melhor vinho de Westeros." 
    },

];

let usuarioAtual = null;

// 3. MONITORAMENTO DE LOGIN E DADOS
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        if (user.uid === ADMIN_UID) {
            document.getElementById('painel-mestre').style.display = 'block';
        }
        escutarDadosUsuario(user.uid);
        escutarAvisoGlobal(); // Nova função
    }
});

// 1. Funções para Troca de Nome
function mostrarTrocaNome() {
    const div = document.getElementById('input-troca-nome');
    div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

async function salvarNovoNome() {
    const novoNome = document.getElementById('novo-nome-input').value;
    if (!novoNome) return alert("Digite um nome válido!");

    try {
        const userRef = doc(db, "usuarios", usuarioAtual.uid);
        await updateDoc(userRef, { nome: novoNome });
        
        document.getElementById('input-troca-nome').style.display = 'none';
        document.getElementById('novo-nome-input').value = '';
        alert("Nome alterado com sucesso, nobre " + novoNome + "!");
    } catch (error) {
        alert("Erro ao trocar nome: " + error.message);
    }
}


function escutarDadosUsuario(uid) {
    onSnapshot(doc(db, "usuarios", uid), (docSnap) => {
        if (docSnap.exists()) {
            const dados = docSnap.data();
            
            // Atualiza Moedas
            document.getElementById('coins').innerText = dados.moedas;
            
            // Atualiza Nome do Personagem no Topo (ID que criamos no HTML)
            document.getElementById('nome-perfil').innerText = "Personagem: " + (dados.nome || "Sem Nome");
            
            // Renderiza o Inventário
            renderizarInventario(dados.inventario || []);
        }
    });
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
              <div class="card-imagem">
                  <img src="${item.imagem}" alt="${item.nome}">
              </div>
                <h3>${item.nome}</h3>
                <p class="efeito">${item.efeito}</p>
                <span class="preco">${item.preco} ic's</span>
                <!-- Chamando o nome que exportamos para o window -->
                <button onclick="comprarItem('${item.nome}', ${item.preco})">Comprar</button>
            </div>
        `;
    });
}

function renderizarInventario(itens) {
    const section = document.getElementById('lista-inventario');
    section.innerHTML = itens.length === 0 ? '<p>Mochila vazia.</p>' : '';
    itens.forEach(item => {
        const valorVenda = Math.floor(item.preco * 0.7);
        section.innerHTML += `
            <div class="card-inventario ${item.raridade}">
                <strong>${item.nome}</strong>
                <!-- Importante: preco vem do objeto item -->
                <button class="btn-vender" onclick="venderItem(${item.idUnico}, ${item.preco})">Vender (${valorVenda} ic's)</button>
            </div>
        `;
    });
}

// 5. LÓGICA DE COMPRA E VENDA (BANCO DE DADOS)
async function comprarItemNoFirebase(nomeItem, precoItem) {
    if (!usuarioAtual) return alert("Você precisa estar logado!");
    const userRef = doc(db, "usuarios", usuarioAtual.uid);
    const docSnap = await getDoc(userRef);
    const dados = docSnap.data();

    if (dados.moedas >= precoItem) {
        const itemDados = itensMercado.find(i => i.nome === nomeItem);
        const novoInventario = [...(dados.inventario || []), { ...itemDados, idUnico: Date.now() }];
        await updateDoc(userRef, { moedas: dados.moedas - precoItem, inventario: novoInventario });
    } else {
        alert("Sem moedas!");
    }
}

async function venderItemNoFirebase(idUnico, precoOriginal) {
    const userRef = doc(db, "usuarios", usuarioAtual.uid);
    const docSnap = await getDoc(userRef);
    const dados = docSnap.data();
    const valorVenda = Math.floor(precoOriginal * 0.7);
    
    const novoInventario = dados.inventario.filter(i => i.idUnico !== idUnico);
    await updateDoc(userRef, { moedas: dados.moedas + valorVenda, inventario: novoInventario });
}

async function fazerCadastro() {
    const nomePersonagem = document.getElementById('login-nome').value; // Captura o nome
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    if (!nomePersonagem) return alert("Escolha um nome para seu personagem!");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // Cria o documento no Firestore já com o nome escolhido
        await setDoc(doc(db, "usuarios", user.uid), {
            nome: nomePersonagem,
            moedas: 1500,
            inventario: []
        });

        alert("Cavaleiro " + nomePersonagem + " registrado!");
    } catch (error) {
        alert("Erro ao cadastrar: " + error.message);
    }
}

async function fazerLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    try {
        await signInWithEmailAndPassword(auth, email, senha);
        // Esconde a tela de login após entrar
        document.getElementById('auth-container').style.display = 'none';
    } catch (error) {
        alert("Erro ao entrar: " + error.message);
    }
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

// --- FUNÇÕES DE CONTROLE DE JOGADORES ---
async function ajustarMoedas(playerUid, quantidade) {
    const playerRef = doc(db, "usuarios", playerUid);
    const snap = await getDoc(playerRef);
    const moedasAtuais = snap.data().moedas || 0;
    await updateDoc(playerRef, { moedas: moedasAtuais + quantidade });
}

async function limparInventario(playerUid) {
    if(confirm("Deseja realmente limpar a mochila deste jogador? (Morte do Personagem)")) {
        await updateDoc(doc(db, "usuarios", playerUid), { inventario: [] });
    }
}


// Função para carregar todos os jogadores em tempo real
function monitorarComunidade() {
    onSnapshot(collection(db, "usuarios"), (querySnapshot) => {
        const mural = document.getElementById('lista-comunidade');
        mural.innerHTML = '';

        querySnapshot.forEach((docSnap) => {
            const player = docSnap.data();
            const pId = docSnap.id;

            // Verifica se quem está vendo o site é o Admin
            const botoesMestre = (usuarioAtual && usuarioAtual.uid === ADMIN_UID) ? `
                <div class="controles-admin">
                    <button class="btn-admin" onclick="ajustarMoedas('${pId}', 100)">+100</button>
                    <button class="btn-admin" onclick="ajustarMoedas('${pId}', -100)">-100</button>
                    <button class="btn-admin btn-vender" onclick="limparInventario('${pId}')">💀 Limpar</button>
                </div>
            ` : '';

            const itensHTML = player.inventario?.map(i => `<span class="item-tag ${i.raridade}">${i.nome}</span>`).join('') || "Vazia";

            mural.innerHTML += `
                <div class="player-card">
                    <h3>${player.nome || 'Desconhecido'}</h3>
                    <div class="player-info">Saldo: ${player.moedas} ic's ${botoesMestre}</div>
                    <div class="player-backpack">${itensHTML}</div>
                </div>
            `;
        });
    });
}

monitorarComunidade();

// 6. TORNAR FUNÇÕES GLOBAIS (PARA O HTML ENXERGAR)
// No final do script.js, adicione estas linhas:
// O nome da esquerda é como o HTML chama, o da direita é o nome real da função no JS
window.fazerLogin = fazerLogin;
window.fazerCadastro = fazerCadastro;
window.filtrarItens = filtrarItens;
window.comprarItem = comprarItemNoFirebase; // Corrigido
window.venderItem = venderItemNoFirebase;   // Corrigido
window.mostrarTrocaNome = mostrarTrocaNome;
window.salvarNovoNome = salvarNovoNome;
window.enviarAviso = enviarAviso;
window.limparAviso = limparAviso;
window.ajustarMoedas = ajustarMoedas;
window.limparInventario = limparInventario;

// Inicia a loja
filtrarItens('todos');