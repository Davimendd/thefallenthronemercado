import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs } from "firebase/firestore";

import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "firebase/auth";

import { collection, getDocs, onSnapshot } from "firebase/firestore";

// 1. COLOQUE SEUS DADOS DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "ID",
    appId: "ID_APP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_UID = "COLOQUE_SEU_UID_AQUI"; // Você descobre esse ID no console do Firebase após logar

// 2. SUA LISTA DE ITENS (MANTIDA)
const itensMercado = [
    { nome: "Adaga de Aço Comum", tipo: "Arma", raridade: "comum", preco: 60, efeito: "1d4 + Agilidade", desc: "Aço barato." },
    { nome: "Espada de Aço de Castelo", tipo: "Arma", raridade: "incomum", preco: 400, efeito: "1d8 + Força", desc: "Equilibrada." },
    { nome: "Lança de Vidro de Dragão", tipo: "Arma", raridade: "epico", preco: 2500, efeito: "1d10 + Agi", desc: "Obsidiana pura." },
    { nome: "Espada de Aço Valiriano", tipo: "Arma", raridade: "lendario", preco: 9500, efeito: "2d6 + Força", desc: "Relíquia ancestral." },
    { nome: "Gibão de Couro Batido", tipo: "Armadura", raridade: "comum", preco: 120, efeito: "+2 Defesa", desc: "Leve." },
    { nome: "Cota de Malha", tipo: "Armadura", raridade: "incomum", preco: 600, efeito: "+4 Defesa | -1 Agi", desc: "Proteção pesada." },
    { nome: "Leite de Papoula", tipo: "Consumível", raridade: "raro", preco: 150, efeito: "Cura 1d10 Vida", desc: "Analgésico." }
];

let usuarioAtual = null;

// 3. MONITORAMENTO DE LOGIN E DADOS
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        escutarDadosUsuario(user.uid);
    } else {
        console.log("Aguardando login...");
        // Se quiser testar sem login agora, você pode chamar uma função de login aqui
    }
});

function escutarDadosUsuario(uid) {
    onSnapshot(doc(db, "usuarios", uid), (docSnap) => {
        if (docSnap.exists()) {
            const dados = docSnap.data();
            document.getElementById('coins').innerText = dados.moedas;
            renderizarInventario(dados.inventario || []);
        } else {
            setDoc(doc(db, "usuarios", uid), {
                nome: auth.currentUser.email,
                moedas: 1500,
                inventario: []
            });
        }
    });
}

// 4. FUNÇÕES DE RENDERIZAÇÃO (INTERFACE)
function filtrarItens(tipoSelecionado) {
    const vitrine = document.getElementById('vitrine');
    vitrine.innerHTML = '';
    let filtrados = tipoSelecionado === 'todos' ? itensMercado : itensMercado.filter(i => i.tipo === tipoSelecionado);

    filtrados.forEach(item => {
        vitrine.innerHTML += `
            <div class="card ${item.raridade}">
                <h3>${item.nome}</h3>
                <p class="efeito">${item.efeito}</p>
                <span class="preco">${item.preco} ic's</span>
                <button onclick="comprarItem('${item.nome}', ${item.preco})">Comprar</button>
            </div>
        `;
    });
}

function renderizarInventario(itens) {
    const section = document.getElementById('lista-inventario');
    section.innerHTML = itens.length === 0 ? '<p>Mochila vazia.</p>' : '';
    itens.forEach(item => {
        section.innerHTML += `
            <div class="card-inventario ${item.raridade}">
                <strong>${item.nome}</strong>
                <button class="btn-vender" onclick="venderItem(${item.idUnico}, ${item.preco})">Vender</button>
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
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    try {
        await createUserWithEmailAndPassword(auth, email, senha);
        alert("Cavaleiro registrado com sucesso!");
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

// Função para carregar todos os jogadores em tempo real
function monitorarComunidade() {
    const colRef = collection(db, "usuarios");
    
    // onSnapshot permite que, se você alterar as moedas de alguém, o mural mude na hora
    onSnapshot(colRef, (querySnapshot) => {
        const mural = document.getElementById('lista-comunidade');
        mural.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const player = doc.data();
            
            // Gerar as tags de itens da mochila
            const itensHTML = player.inventario && player.inventario.length > 0 
                ? player.inventario.map(i => `<span class="item-tag ${i.raridade}">${i.nome}</span>`).join('')
                : "<em>Mochila vazia</em>";

            mural.innerHTML += `
                <div class="player-card">
                    <h3>${player.nome || 'Cavaleiro Misterioso'}</h3>
                    <div class="player-info"><strong>Saldo:</strong> ${player.moedas} ic's</div>
                    <div class="player-backpack">
                        <strong>Mochila:</strong><br>
                        ${itensHTML}
                    </div>
                </div>
            `;
        });
    });
}

monitorarComunidade();

// 6. TORNAR FUNÇÕES GLOBAIS (PARA O HTML ENXERGAR)
window.comprarItem = comprarItemNoFirebase;
window.venderItem = venderItemNoFirebase;
window.filtrarItens = filtrarItens;
window.fazerLogin = fazerLogin;
window.fazerCadastro = fazerCadastro;

// Inicia a loja
filtrarItens('todos');