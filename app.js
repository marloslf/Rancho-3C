/* =========================================================================
   1. CONFIGURAÇÕES E ESTADO GERAL
========================================================================= */
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbx4Gc3P2B0Jh7_piAm9a-auSTSYrXDqsVS5FkXXjciddgzOhhlHISRTGo-PGuNpBgQD3w/exec";

let transacoes = []; let agriRecords = []; let estoque = []; let chuvas = []; let analisesSolo = [];
// As listas agora moram em cadastros dentro de opcoesDin para sincronizar na nuvem
let opcoesDin = { 
    talhoes: [], tipos: [], formas: [], alvos: [], talhoesInfo: {},
    cadastros: { d_categorias: [], d_setores: [], d_fornecedores: [], r_produtos: [], r_clientes: [] }
};

let colOrdenacao = 'data'; let ordemAscendente = false; let filtroRapido = '';
let chartCaixaObj = null, chartPendenteObj = null; let chartS_Agri = null, chartT_Agri = null, chartTp_Agri = null, chartCS_Agri = null, chartCT_Agri = null; let chartChuvasObj = null;
let permissaoNuvem = false; 
let chartSoloPrincipal = null, chartSoloMicros = null;
let reqGeralCalc = { n: 0, p: 0, k: 0, zn: 0, b: 0, cu: 0, mn: 0 };
let cronogramaFinal = [];
let estSortCol = 'produto', estSortAsc = true;
let ultimaListaFiltrada = [];

const categoriasInsumo = ["ACARICIDA", "ADUBO", "ADUBO FOLIAR", "BACTERICIDA", "FUNGICIDA", "HERBICIDA", "INSETICIDA", "INSUMOS"];
const setoresLavoura = ["CAFÉ", "CAFÉ 01", "CAFÉ 02", "CAFÉ 03", "LAVOURAS", "MARACUJÁ"];

// Variáveis para a Cascata N-Levels
let cascataEstado = { tipoFiltro: 'Despesa', niveis: [], selecoes: [] };

/* =========================================================================
   2. UTILITÁRIOS E CORREÇÃO DO DOM
========================================================================= */
function generateUUID() { return 'v2-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
function hojeLocal() { const d = new Date(); return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10); }
function strSafe(val) { return (val === null || val === undefined) ? '' : String(val).trim(); }

function sanitizeDateString(d) {
    if(!d) return ''; d = String(d);
    if (d.includes('T') && d.length >= 10 && d.charAt(4) === '-') return d.split('T')[0];
    if (d.includes('T') && d.includes('/')) {
        let parts = d.split('/');
        if(parts.length === 3) { let day = parts[0].split('T')[0]; return `${parts[2]}-${parts[1].padStart(2,'0')}-${day.padStart(2, '0')}`; }
    }
    return d;
}

function formatarData(dataISO) { 
    dataISO = sanitizeDateString(dataISO);
    if(!dataISO || dataISO.toLowerCase() === 'nan') return '-'; 
    const partes = dataISO.split('-'); return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataISO; 
}

function formatarMoeda(valor) { const num = parseFloat(valor); return isNaN(num) ? '-' : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function strEscape(val) { const s = strSafe(val); return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function parseNS(valStr) { if (!valStr || String(valStr).toLowerCase() === 'ns') return 0; let v = parseFloat(String(valStr).replace(',', '.')); return isNaN(v) ? 0 : v; }
function safeVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }

function setVal(id, valor) {
    const el = document.getElementById(id);
    if (el) { if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') { el.value = valor; } else { el.innerText = valor; } }
}

function setHtml(id, htmlStr) {
    const el = document.getElementById(id);
    if (el) { let old = el.value; el.innerHTML = htmlStr; if(old) el.value = old; }
}

function mostrarToast(msg) { 
    const toast = document.getElementById("toast"); 
    if(toast) { toast.innerText = msg; toast.classList.add("show"); setTimeout(() => { toast.classList.remove("show"); }, 3000); } 
}

function obterSafraGeral(dataStr) { 
    dataStr = sanitizeDateString(dataStr);
    if(!dataStr || dataStr === '-' || dataStr === '') return 'Sem Data'; 
    let partes = dataStr.split('-'); if(partes.length !== 3) return 'Sem Data'; 
    let ano = parseInt(partes[0], 10); let mes = parseInt(partes[1], 10); if (isNaN(ano) || isNaN(mes)) return 'Sem Data'; 
    let anoInicio = mes >= 8 ? ano : ano - 1; return anoInicio.toString().slice(-2) + '/' + (anoInicio + 1).toString().slice(-2); 
}
function obterSafraAtual() { return obterSafraGeral(hojeLocal()); }

/* =========================================================================
   3. LEITOR DE XML (NF-E)
========================================================================= */
function importarXMLDespesa(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        try {
            let dhEmi = xmlDoc.getElementsByTagName("dhEmi")[0] || xmlDoc.getElementsByTagName("dEmi")[0];
            let dataNF = dhEmi ? dhEmi.textContent.substring(0, 10) : hojeLocal();

            let emit = xmlDoc.getElementsByTagName("emit")[0];
            let fornecedor = emit && emit.getElementsByTagName("xNome")[0] ? emit.getElementsByTagName("xNome")[0].textContent.toUpperCase() : "FORNECEDOR NF";

            let dets = xmlDoc.getElementsByTagName("det");
            if (dets.length === 0) throw new Error("Sem itens");

            let importarMultiplos = false;
            if (dets.length > 1) {
                importarMultiplos = confirm(`Encontramos ${dets.length} itens nesta NF-e.\n\nDeseja importar TODOS os itens automaticamente para a tabela de lançamentos?\n(Serão gravados como 'A PAGAR')`);
            }
            
            // Garantir que o fornecedor existe nos cadastros
            if (!opcoesDin.cadastros.d_fornecedores.includes(fornecedor)) { opcoesDin.cadastros.d_fornecedores.push(fornecedor); opcoesDin.cadastros.d_fornecedores.sort(); }

            if (dets.length === 1 || !importarMultiplos) {
                // Preenche o Modal novo
                abrirModalNovoLancamento('Despesa');
                setVal('md_data', dataNF);
                preencherSelectsLancamento(); // recarrega opções
                setVal('md_local', fornecedor);
                
                let prod = dets[0].getElementsByTagName("prod")[0];
                if (prod) {
                    setVal('md_descricao', (prod.getElementsByTagName("xProd")[0] ? prod.getElementsByTagName("xProd")[0].textContent : "").toUpperCase());
                    setVal('md_qtd', parseFloat(prod.getElementsByTagName("qCom")[0] ? prod.getElementsByTagName("qCom")[0].textContent : 0).toFixed(2));
                    setVal('md_v_unit', parseFloat(prod.getElementsByTagName("vUnCom")[0] ? prod.getElementsByTagName("vUnCom")[0].textContent : 0).toFixed(2));
                    setVal('md_und', (prod.getElementsByTagName("uCom")[0] ? prod.getElementsByTagName("uCom")[0].textContent : "UN").toUpperCase());
                    let vProd = prod.getElementsByTagName("vProd")[0] ? parseFloat(prod.getElementsByTagName("vProd")[0].textContent) : 0;
                    setVal('md_valor', vProd.toFixed(2));
                }
                mostrarToast("Item carregado no formulário! Revise a Categoria e Setor.");
            } else {
                let tipoFinal = document.getElementById('md_natureza') ? document.getElementById('md_natureza').value : 'Despesa';
                let categoriaCat = document.getElementById('md_categoria') ? document.getElementById('md_categoria').value.trim() : "A CLASSIFICAR";
                let setorCat = document.getElementById('md_setor') ? document.getElementById('md_setor').value.trim() : "-";
                let talhaoImp = document.getElementById('md_talhao') ? document.getElementById('md_talhao').value.trim() : "";

                if(categoriaCat && !opcoesDin.cadastros.d_categorias.includes(categoriaCat)) { opcoesDin.cadastros.d_categorias.push(categoriaCat); }
                if(setorCat && !opcoesDin.cadastros.d_setores.includes(setorCat)) { opcoesDin.cadastros.d_setores.push(setorCat); }

                let novas = [], repetidas = 0;
                for(let i = 0; i < dets.length; i++) {
                    let prod = dets[i].getElementsByTagName("prod")[0];
                    if(!prod) continue;
                    
                    let desc = (prod.getElementsByTagName("xProd")[0] ? prod.getElementsByTagName("xProd")[0].textContent : "ITEM SEM NOME").toUpperCase();
                    let qtd = parseFloat(prod.getElementsByTagName("qCom")[0] ? prod.getElementsByTagName("qCom")[0].textContent : 0);
                    let vUn = parseFloat(prod.getElementsByTagName("vUnCom")[0] ? prod.getElementsByTagName("vUnCom")[0].textContent : 0);
                    let vTot = parseFloat(prod.getElementsByTagName("vProd")[0] ? prod.getElementsByTagName("vProd")[0].textContent : 0);
                    let und = (prod.getElementsByTagName("uCom")[0] ? prod.getElementsByTagName("uCom")[0].textContent : "UN").toUpperCase();

                    const jaExiste = transacoes.some(x => x && !x.deleted && x.obs === 'Importação Automática XML' && sanitizeDateString(x.data) === dataNF && x.local === fornecedor && x.desc === desc && parseFloat(x.valor) === vTot);
                    if (jaExiste) { repetidas++; continue; }

                    const nt = {
                        id: generateUUID(), updatedAt: Date.now(), deleted: false,
                        data: dataNF, tipo: tipoFinal, categoria: categoriaCat,
                        setor: setorCat, talhao: talhaoImp, talhao2: '', pct: 100, local: fornecedor, desc: desc,
                        qtd: qtd, und: und, v_unit: vUn, valor: vTot, sit: 'A pagar', obs: 'Importação Automática XML'
                    };
                    transacoes.push(nt); novas.push(nt);
                }
                
                document.getElementById('modal-novo-lancamento').style.display = 'none';

                if (novas.length && confirm(`Dar entrada de ${novas.length} item(ns) no estoque?\n(Só itens com unidade L, KG, G ou ML são lançados.)`)) {
                    let ok = 0;
                    novas.forEach(nt => {
                        const conv = normalizarUnidadeEstoque(nt.und, parseFloat(nt.qtd) || 0);
                        if (!conv || conv.qtd <= 0 || !(nt.valor > 0)) return;
                        const tipoEst = categoriasInsumo.includes(nt.categoria) ? nt.categoria : 'INSUMOS';
                        verificarNovaOpcao('tipos', tipoEst);
                        nt.est_mov = { id: entradaEstoque(nt.desc, '', tipoEst, conv.qtd, conv.un, nt.valor / conv.qtd), qtd: conv.qtd, un: conv.un };
                        ok++;
                    });
                    renderDatalistsAgri();
                    mostrarToast(`${ok} item(ns) entraram no estoque`);
                }
                salvarDados();
                atualizarTudo();
                mostrarToast(`${novas.length} itens importados${repetidas ? ' (' + repetidas + ' já existiam)' : ''}!`);
            }
        } catch (error) {
            alert("Erro ao processar XML. Certifique-se de que é um arquivo de NF-e válido.");
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

/* =========================================================================
   4. SINCRONIZAÇÃO E ALGORITMO HASH UNIFICADOR
========================================================================= */
function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; } return (h >>> 0).toString(36); }

function unificarPorId(localArr, cloudArr, hashFn) {
    const map = new Map();
    const adicionar = item => {
        if (!item) return;
        if (!item.id) item.id = 'L' + djb2(hashFn(item));
        const ex = map.get(item.id);
        if (!ex || (item.updatedAt || 0) >= (ex.updatedAt || 0)) map.set(item.id, item);
    };
    (cloudArr || []).