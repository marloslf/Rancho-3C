/* =========================================================================
   1. CONFIGURAÇÕES E ESTADO GERAL
========================================================================= */
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbx4Gc3P2B0Jh7_piAm9a-auSTSYrXDqsVS5FkXXjciddgzOhhlHISRTGo-PGuNpBgQD3w/exec";

const ESTRUTURA_DESPESAS = {
    "ADUBO": ["CAFÉ 1", "CAFÉ 2", "CAFÉ 3", "MARACUJÁ", "FAZENDA"],
    "DEFENSIVO": ["CAFÉ 1", "CAFÉ 2", "CAFÉ 3", "MARACUJÁ", "FAZENDA"],
    "COMBUSTÍVEL": ["ADMINISTRAÇÃO", "FAZENDA", "TRATOR"],
    "MÃO DE OBRA": ["CAFÉ 1", "CAFÉ 2", "CAFÉ 3", "MARACUJÁ", "FAZENDA", "SALÁRIO"],
    "ENERGIA": ["FAZENDA", "IRRIGAÇÃO"],
    "RAÇÃO": ["CAVALOS", "GALINHAS", "PEIXES", "PETS", "GADO"],
    "MANUTENÇÃO": ["FAZENDA", "IRRIGAÇÃO", "EQUIPAMENTOS"],
    "FINANÇAS": ["CONTABILIDADE", "IMPOSTOS", "PRÓ-LABORE"]
};
const dCategoriasPadrao = Object.keys(ESTRUTURA_DESPESAS);
const dSetoresPadrao = [...new Set(Object.values(ESTRUTURA_DESPESAS).reduce((a, b) => a.concat(b), []))];
const UNIDADES_PADRAO = ["KG", "G", "L", "ML", "SC", "UN", "PCT", "DZ", "CX", "SACO", "M", "M²", "M³", "T", "H", "DIA", "MÊS", "R$"];
const rCategoriasPadrao = ["ACEROLA - POLPA", "CAFÉ 250G", "CAFÉ 500G", "CAFÉ EM GRÃOS", "CAFÉ SACA", "CRÉDITO", "ESTACAS DE EUCALÍPTO", "GRAVIOLA - POLPA S/SEM.", "MARACUJÁ - FRUTO", "MARACUJÁ - POLPA C/SEM.", "MARACUJÁ - POLPA S/SEM.", "OVOS", "PASTO - ALUGUEL", "RENDIMENTOS"];
const unidadesReceita = { "ACEROLA - POLPA": "KG", "CAFÉ 250G": "PCT", "CAFÉ 500G": "PCT", "CAFÉ EM GRÃOS": "PCT", "CAFÉ SACA": "SC", "CRÉDITO": "R$", "ESTACAS DE EUCALÍPTO": "UN", "GRAVIOLA - POLPA S/SEM.": "KG", "MARACUJÁ - FRUTO": "KG", "MARACUJÁ - POLPA C/SEM.": "KG", "MARACUJÁ - POLPA S/SEM.": "KG", "OVOS": "DZ", "PASTO - ALUGUEL": "MÊS", "RENDIMENTOS": "R$" };

let transacoes = []; let agriRecords = []; let estoque = []; let chuvas = []; let analisesSolo = [];
let opcoesDin = { talhoes: ["CAFÉ 01", "CAFÉ 02", "CAFÉ 03"], tipos: [], formas: [], alvos: [], talhoesInfo: {} };
let colOrdenacao = 'data'; let ordemAscendente = false; let filtroRapido = '';
let chartCaixaObj = null, chartPendenteObj = null; let chartS_Agri = null, chartT_Agri = null, chartTp_Agri = null, chartCS_Agri = null, chartCT_Agri = null; let chartChuvasObj = null;
let permissaoNuvem = false; 
let chartSoloPrincipal = null, chartSoloMicros = null;
let reqGeralCalc = { n: 0, p: 0, k: 0, zn: 0, b: 0, cu: 0, mn: 0 };
let cronogramaFinal = [];
let estSortCol = 'produto', estSortAsc = true;
let ultimaListaFiltrada = [];
const categoriasInsumo = ["ACARICIDA", "ADUBO", "ADUBO FOLIAR", "BACTERICIDA", "DEFENSIVO", "FUNGICIDA", "HERBICIDA", "INSETICIDA", "INSUMOS"];

// Setores do caixa diário que representam lavouras (entram no custo por talhão, além dos talhões cadastrados)
const setoresLavoura = ["CAFÉ", "CAFÉ 01", "CAFÉ 02", "CAFÉ 03", "LAVOURAS", "MARACUJÁ"];

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

// CORREÇÃO CRÍTICA 1: O setVal não destruirá mais os seletores
function setVal(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
            el.value = valor;
        } else {
            el.innerText = valor;
        }
    }
}

function setHtml(id, htmlStr) {
    const el = document.getElementById(id);
    if (el) {
        let old = el.value;
        el.innerHTML = htmlStr;
        if(old) el.value = old;
    }
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

            if (dets.length === 1 || !importarMultiplos) {
                setVal('d_data', dataNF);
                if (!cadTem('fornecedor', fornecedor)) {
                    if (confirm(`O fornecedor "${fornecedor}" ainda não está cadastrado.\n\nDeseja cadastrá-lo agora?`)) { cadAdicionar('fornecedor', fornecedor); salvarDados(); preencherSelectsLancamento(); }
                    else { fornecedor = ''; }
                }
                setVal('d_local', fornecedor);
                let prod = dets[0].getElementsByTagName("prod")[0];
                if (prod) {
                    setVal('d_descricao', (prod.getElementsByTagName("xProd")[0] ? prod.getElementsByTagName("xProd")[0].textContent : "").toUpperCase());
                    setVal('d_qtd', parseFloat(prod.getElementsByTagName("qCom")[0] ? prod.getElementsByTagName("qCom")[0].textContent : 0).toFixed(2));
                    setVal('d_v_unit', parseFloat(prod.getElementsByTagName("vUnCom")[0] ? prod.getElementsByTagName("vUnCom")[0].textContent : 0).toFixed(2));
                    const undNF = (prod.getElementsByTagName("uCom")[0] ? prod.getElementsByTagName("uCom")[0].textContent : "UN").toUpperCase();
                    if (undNF && !cadTem('unidade', undNF)) { cadAdicionar('unidade', undNF); preencherSelectsLancamento(); }
                    setVal('d_und', undNF);
                    
                    let vProd = prod.getElementsByTagName("vProd")[0] ? parseFloat(prod.getElementsByTagName("vProd")[0].textContent) : 0;
                    setVal('d_valor', vProd.toFixed(2));
                }
                revalidarCadastros();
                mostrarToast("Item carregado no formulário! Revise e grave.");
            } else {
                let tipoFinal = document.getElementById('d_natureza').value;
                let categoriaCat = cadNorm(safeVal('d_categoria'));
                let setorCat = cadNorm(safeVal('d_setor'));
                if (!cadTem('categoria_despesa', categoriaCat) || !cadTem('setor', setorCat)) {
                    alert("Para importar vários itens de uma vez, escolha antes, nesta janela, a Categoria e o Setor (itens cadastrados) e use 'Ler NF-e (XML)' novamente.");
                    event.target.value = ''; return;
                }
                const talhaoTxt = cadNorm(safeVal('d_talhao'));
                if (talhaoTxt && !cadTem('talhao', talhaoTxt)) { alert("O Talhão informado não está cadastrado."); event.target.value = ''; return; }
                if (!cadTem('fornecedor', fornecedor)) {
                    if (confirm(`O fornecedor "${fornecedor}" ainda não está cadastrado.\n\nDeseja cadastrá-lo agora para importar?`)) { cadAdicionar('fornecedor', fornecedor); }
                    else { event.target.value = ''; return; }
                }

                const talhaoImp = strSafe(safeVal('d_talhao')).toUpperCase();
                let novas = [], repetidas = 0;
                for(let i = 0; i < dets.length; i++) {
                    let prod = dets[i].getElementsByTagName("prod")[0];
                    if(!prod) continue;
                    
                    let desc = (prod.getElementsByTagName("xProd")[0] ? prod.getElementsByTagName("xProd")[0].textContent : "ITEM SEM NOME").toUpperCase();
                    let qtd = parseFloat(prod.getElementsByTagName("qCom")[0] ? prod.getElementsByTagName("qCom")[0].textContent : 0);
                    let vUn = parseFloat(prod.getElementsByTagName("vUnCom")[0] ? prod.getElementsByTagName("vUnCom")[0].textContent : 0);
                    let vTot = parseFloat(prod.getElementsByTagName("vProd")[0] ? prod.getElementsByTagName("vProd")[0].textContent : 0);
                    let und = (prod.getElementsByTagName("uCom")[0] ? prod.getElementsByTagName("uCom")[0].textContent : "UN").toUpperCase();
                    if (und && !cadTem('unidade', und)) cadAdicionar('unidade', und);

                    // Evita duplicar a mesma NF-e importada duas vezes
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
                preencherSelectsSafraFin(); atualizarOpcoesFiltros(); aplicarFiltros(); preencherSelectsLancamento();
                mostrarToast(`${novas.length} itens importados${repetidas ? ' (' + repetidas + ' já existiam)' : ''}!`);
                fecharModalLancamento('despesa');
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
function unificarDados(localArr, cloudArr, hashFn) {
    let map = new Map();
    (cloudArr || []).forEach(item => {
        if(!item || item.deleted) return;
        let hash = hashFn(item);
        if(!item.id) item.id = generateUUID();
        map.set(hash, item);
    });

    (localArr || []).forEach(item => {
        if(!item) return;
        let hash = hashFn(item);
        if (item.deleted) {
            map.delete(hash); 
        } else {
            if(!item.id) item.id = generateUUID();
            if(map.has(hash)) {
                let existente = map.get(hash);
                if(item.updatedAt && existente.updatedAt && item.updatedAt > existente.updatedAt) { map.set(hash, item); } 
                else if (!existente.updatedAt) { map.set(hash, item); }
            } else {
                map.set(hash, item); 
            }
        }
    });
    return Array.from(map.values());
}

let hashTransacao = t => `${sanitizeDateString(t.data)}_${strSafe(t.tipo)}_${strSafe(t.categoria)}_${t.valor}_${strSafe(t.desc)}`;
let hashAgri = a => `${sanitizeDateString(a.data)}_${strSafe(a.talhao)}_${strSafe(a.produto)}_${a.dosagem_qtd}`;
let hashSolo = s => `${sanitizeDateString(s.data)}_${strSafe(s.talhao)}_${strSafe(s.prof)}`;
let hashEstoque = e => `${strSafe(e.produto)}_${strSafe(e.un)}`;
let hashChuva = c => sanitizeDateString(c.data);

async function carregarDadosNuvem() {
    const statusDiv = document.getElementById('status_conexao');
    statusDiv.innerHTML = '⏳ Sincronizando...'; statusDiv.className = 'status-conexao aguardando';
    
    try {
        const localStr = localStorage.getItem('rancho3c_offline');
        if (localStr) {
            const localData = JSON.parse(localStr);
            transacoes = localData.transacoes || []; agriRecords = localData.aplicacoes || [];
            estoque = Array.isArray(localData.estoque) ? localData.estoque : Object.values(localData.estoque || {});
            analisesSolo = localData.analises || []; opcoesDin = localData.opcoes || opcoesDin; garantirOpcoes();
            chuvas = localData.chuvas || [];
        }
    } catch(e){}

    try {
        const response = await fetch(URL_GOOGLE_SCRIPT);
        if(!response.ok) throw new Error("HTTP Error");
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            transacoes = unificarPorId(transacoes, data.transacoes, hashTransacao);
            agriRecords = unificarPorId(agriRecords, data.aplicacoes, hashAgri);
            analisesSolo = unificarDados(analisesSolo, data.analises, hashSolo);
            estoque = unificarDados(estoque, Array.isArray(data.estoque) ? data.estoque : Object.values(data.estoque || {}), hashEstoque);
            chuvas = unificarDados(chuvas, data.chuvas, hashChuva);

            if(data.opcoes) mesclarOpcoes(data.opcoes);
        }
        permissaoNuvem = true; 
        statusDiv.innerHTML = '🟢 DADOS SINCRONIZADOS'; statusDiv.className = 'status-conexao conectado';
    } catch(e) {
        permissaoNuvem = false; 
        transacoes = unificarPorId(transacoes, [], hashTransacao); agriRecords = unificarPorId(agriRecords, [], hashAgri); analisesSolo = unificarDados(analisesSolo, [], hashSolo);
        estoque = unificarDados(estoque, [], hashEstoque); chuvas = unificarDados(chuvas, [], hashChuva);
        statusDiv.innerHTML = '🔴 SEM CONEXÃO (SALVO NO APARELHO)'; statusDiv.className = 'status-conexao erro';
    }

    try { semearCadastros(); migrarEstruturaDespesas(); migrarLavouras(); migrarColheita(); } catch(e) {}
    const payload = { transacoes, aplicacoes: agriRecords, estoque, opcoes: opcoesDin, analises: analisesSolo, chuvas };
    try { localStorage.setItem('rancho3c_offline', JSON.stringify(payload)); } catch(err) {}

    try { preencherSelectsLancamento(); popularSeletorSolo(); preencherSelectsSafraFin(); renderDatalistsAgri(); popularSeletorSafraApp(); } catch(e){}
    garantirOpcoes();
    try { atualizarAlertas(); } catch(e){}
    if(permissaoNuvem) salvarDados();
    showTab('home');
}

let isSaving = false;
let pendingSave = false;

async function salvarDados() {
    try { atualizarAlertas(); } catch(e) {}
    const statusDiv = document.getElementById('status_conexao');
    const payload = { transacoes, aplicacoes: agriRecords, estoque, opcoes: opcoesDin, analises: analisesSolo, chuvas };
    
    try { localStorage.setItem('rancho3c_offline', JSON.stringify(payload)); } catch(err) { mostrarToast("Erro local: Memória Cheia!"); }
    
    if (!permissaoNuvem) { statusDiv.innerHTML = '🔴 SALVO NO APARELHO'; statusDiv.className = 'status-conexao erro'; return; }

    if (isSaving) { pendingSave = true; return; }
    
    isSaving = true;
    statusDiv.innerHTML = '⏳ Gravando...'; statusDiv.className = 'status-conexao aguardando';
    
    try {
        const response = await fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify(Object.assign({}, payload, { opcoes: empacotarOpcoes() })), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        if(!response.ok) throw new Error("HTTP Error");
        statusDiv.innerHTML = `🟢 SINCRONIZADO`; statusDiv.className = 'status-conexao conectado'; 
    } catch (e) { 
        permissaoNuvem = false; statusDiv.innerHTML = '🔴 SALVO NO APARELHO'; statusDiv.className = 'status-conexao erro'; 
    } finally {
        isSaving = false;
        if (pendingSave) {
            pendingSave = false;
            salvarDados();
        }
    }
}

function showTab(id) {
    try {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.topbar button').forEach(b => b.classList.remove('btn-ativo'));
        document.getElementById(id).classList.add('active');
        const btnMap = { 'home': 'btn_home', 'resumo': 'btn_resumo', 'movimentacoes': 'btn_movimentacoes', 'relatorios_detalhados': 'btn_relatorios_detalhados', 'pendencias': 'btn_pendencias', 'agri_app': 'btn_agri_app', 'agri_rel': 'btn_agri_app', 'agri_est': 'btn_agri_est', 'agri_dash': 'btn_agri_dash', 'chuvas_main': 'btn_chuvas', 'solo_main': 'btn_solo', 'talhoes_main': 'btn_talhoes', 'cadastros_main': 'btn_cadastros' };
        if(btnMap[id]) document.getElementById(btnMap[id]).classList.add('btn-ativo');
        try { fecharMenusTopo(); atualizarMarcasMenu(); } catch (e2) {}
        
        if(id === 'resumo') atualizarResumoEGrafico();
        if(id === 'relatorios_detalhados') { atualizarRelatoriosDetalhados(); renderCascataCategorias(); }
        if(id === 'movimentacoes') { atualizarOpcoesFiltros(); aplicarFiltros(); }
        if(id === 'pendencias') { renderizarTabelasPendencias(); atualizarAlertas(); }
        if(id === 'agri_app') aplicarFiltroSafraApp();
        if(id === 'agri_rel') popularFiltrosRelAgri();
        if(id === 'talhoes_main') renderTalhoes();
        if(id === 'cadastros_main') renderCadastros();
        if(id === 'agri_est') saveAndRenderEstoque();
        if(id === 'agri_dash') renderAgriDashboard();
        if(id === 'solo_main') { popularSeletorSolo(); renderizarHistoricoSolo(); }
        if(id === 'chuvas_main') { let m = hojeLocal().substring(5,7); setVal('cv_data', hojeLocal()); setVal('filtro_mes_chuva', m); renderChuvas(); }
    } catch(e) {}
    const mainContent = document.querySelector('.main-content');
    if(mainContent) mainContent.scrollTo(0, 0); 
}

/* =========================================================================
   5. MÓDULO CHUVAS
========================================================================= */
function addChuva(e) {
    e.preventDefault();
    const dataStr = safeVal('cv_data'); const mmStr = safeVal('cv_mm'); const idEdicao = safeVal('cv_id');
    if(!dataStr || !mmStr) return;

    const nova = { id: idEdicao ? idEdicao : generateUUID(), updatedAt: Date.now(), deleted: false, data: sanitizeDateString(dataStr), mm: parseFloat(mmStr) };

    if (idEdicao) {
        let idx = chuvas.findIndex(c => c.id === idEdicao);
        if(idx > -1) chuvas[idx] = nova;
    } else {
        let existente = chuvas.find(c => !c.deleted && c.data === nova.data);
        if(existente) {
            if(!confirm(`Já existe um registro de ${existente.mm} mm para este dia. Deseja substituir por ${nova.mm} mm?`)) return;
            existente.mm = nova.mm; existente.updatedAt = Date.now();
        } else { chuvas.push(nova); }
    }
    
    salvarDados(); document.getElementById('form_chuva').reset(); setVal('cv_id', ''); setVal('cv_data', hojeLocal());
    renderChuvas(); mostrarToast("Chuva Registrada!");
    focarPrimeiroCampo('cv_data');
}

function renderChuvas() {
    let limpos = chuvas.filter(c => c && !c.deleted && c.data);
    limpos.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    let html = '';
    limpos.forEach(c => {
        html += `<tr><td>${formatarData(c.data)}</td><td style="font-weight:700; color:var(--cor-azul-flat);">${c.mm} mm</td>
        <td class="no-print" style="text-align:center;"><button class="btn-acao btn-editar" onclick="editChuva('${c.id}')">✏️</button><button class="btn-acao btn-excluir" onclick="deleteChuva('${c.id}')">🗑️</button></td></tr>`;
    });
    document.getElementById('tbody_chuvas').innerHTML = html || '<tr><td colspan="3" style="text-align:center; padding:30px; color:#aaa;">Sem registros de chuvas</td></tr>';
    renderChartChuvas();
}

function editChuva(id) {
    let c = chuvas.find(x => x.id === id); if(!c || c.deleted) return;
    setVal('cv_id', c.id); setVal('cv_data', c.data); setVal('cv_mm', c.mm); document.getElementById('cv_mm').focus();
}

function deleteChuva(id) {
    if(confirm("Excluir este registro de chuva?")) {
        let c = chuvas.find(x => x.id === id);
        if(c) { c.deleted = true; c.updatedAt = Date.now(); salvarDados(); renderChuvas(); mostrarToast("Registro Excluído"); }
    }
}

function renderChartChuvas() {
    if (typeof Chart === 'undefined') return;
    const mesSelecionado = safeVal('filtro_mes_chuva');
    let validos = chuvas.filter(c => c && !c.deleted && c.data && sanitizeDateString(c.data).substring(5,7) === mesSelecionado);
    
    let dadosPorAno = {};
    validos.forEach(c => {
        let dStr = sanitizeDateString(c.data);
        let ano = dStr.substring(0,4); let dia = parseInt(dStr.substring(8,10), 10);
        if(!dadosPorAno[ano]) dadosPorAno[ano] = new Array(31).fill(0);
        dadosPorAno[ano][dia - 1] += parseFloat(c.mm);
    });

    let labels = Array.from({length: 31}, (_, i) => i + 1);
    let datasets = [];
    let colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e'];
    let colorIdx = 0;
    
    Object.keys(dadosPorAno).sort().reverse().forEach(ano => {
        datasets.push({ label: `Ano ${ano}`, data: dadosPorAno[ano], borderColor: colors[colorIdx % colors.length], backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 });
        colorIdx++;
    });

    if (chartChuvasObj) chartChuvasObj.destroy();
    const ctx = document.getElementById('chartChuvas').getContext('2d');
    chartChuvasObj = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Milímetros (mm)' } }, x: { title: { display: true, text: 'Dia do Mês' } } } } });
}

/* =========================================================================
   6. MÓDULO FINANCEIRO
========================================================================= */
function preencherSelectsSafraFin() {
    let safras = new Set(); transacoes.forEach(t => { if(!t.deleted && t.data && t.data !== '-') safras.add(obterSafraGeral(t.data)); });
    let arrSafras = Array.from(safras).filter(s => s !== 'Sem Data').sort().reverse(); 
    let htmlOptions = '<option value="">TODAS AS SAFRAS</option>';
    arrSafras.forEach(s => htmlOptions += `<option value="${s}">Safra ${s}</option>`);
    setHtml('filtro_safra_dashboard', htmlOptions); setHtml('filtro_safra_relatorios', htmlOptions);
}

function atualizarResumoEGrafico() {
    let tR = 0, tD = 0, tI = 0, aR = 0, aP = 0, rCat = {}, dCat = {}, qtdAtrasadas = 0; const hojeObj = new Date(hojeLocal() + 'T00:00:00');
    const filtroMes = safeVal('filtro_mes_dashboard');
    const filtroSafra = safeVal('filtro_safra_dashboard');

    transacoes.forEach(t => {
        if (t.deleted) return;
        if (filtroSafra && obterSafraGeral(t.data) !== filtroSafra) return;
        if (filtroMes && (!t.data || !sanitizeDateString(t.data).startsWith(filtroMes))) return;

        let v = parseFloat(t.valor) || 0; let sit = strSafe(t.sit).toLowerCase(); let tipo = String(t.tipo).toLowerCase();
        let cat = strSafe(t.categoria); if (!cat || cat === '-') cat = (tipo === 'receita') ? strSafe(t.desc) : strSafe(t.setor); cat = cat.toUpperCase();

        if (tipo === 'receita') {
            if (sit.includes('pago')) { tR += v; rCat[cat] = (rCat[cat] || 0) + v; } else if (sit.includes('receber') || sit.includes('pagar')) aR += v;
        } else if (tipo === 'despesa') {
            if (sit.includes('pago')) { tD += v; dCat[cat] = (dCat[cat] || 0) + v; } else if (sit.includes('pagar') || sit.includes('receber')) { aP += v; if(t.data && new Date(String(sanitizeDateString(t.data)) + 'T00:00:00') < hojeObj) qtdAtrasadas++; }
        } else if (tipo === 'investimento') {
            if (sit.includes('pago')) { tI += v; dCat[cat] = (dCat[cat] || 0) + v; } else if (sit.includes('pagar') || sit.includes('receber')) { aP += v; if(t.data && new Date(String(sanitizeDateString(t.data)) + 'T00:00:00') < hojeObj) qtdAtrasadas++; }
        }
    });

    atualizarAlertas();
    document.getElementById('res_receitas').innerText = formatarMoeda(tR); document.getElementById('res_despesas').innerText = formatarMoeda(tD); document.getElementById('res_investimentos').innerText = formatarMoeda(tI);
    document.getElementById('res_saldo').innerText = formatarMoeda(tR - tD - tI);

    if (typeof Chart !== 'undefined') {
        if (chartCaixaObj) chartCaixaObj.destroy(); if (chartPendenteObj) chartPendenteObj.destroy();
        const ctxCaixa = document.getElementById('canvas_caixa').getContext('2d');
        chartCaixaObj = new Chart(ctxCaixa, { type: 'doughnut', data: { labels: ['Receitas', 'Custeio', 'Investimentos'], datasets: [{ data: [tR, tD, tI], backgroundColor: ['#62d073', '#f49f3e', '#9b59b6'], borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } }, layout: { padding: 10 } } });
        const ctxPendente = document.getElementById('canvas_pendente').getContext('2d');
        chartPendenteObj = new Chart(ctxPendente, { type: 'doughnut', data: { labels: ['A Receber', 'A Pagar'], datasets: [{ data: [aR, aP], backgroundColor: ['#3498db', '#e74c3c'], borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } }, layout: { padding: 10 } } });
    }

    let arrRCat = Object.entries(rCat).sort((a,b) => b[1] - a[1]).slice(0, 5); let maxRCat = arrRCat.length > 0 ? arrRCat[0][1] : 0; let hR = '';
    arrRCat.forEach(x => { 
        let perc = maxRCat > 0 ? (x[1] / maxRCat) * 100 : 0; let codeStr = encodeURIComponent(x[0]); 
        hR += `<li class="item-lista-grafico" onclick="abrirDetalheCategoria('${codeStr}', 'Receita')" title="Clique para ver detalhes"><div style="display:flex; justify-content:space-between;"><span>${strEscape(x[0])}</span> <span>${formatarMoeda(x[1])}</span></div><div class="barra-grafico-container"><div class="barra-grafico-receita" style="width: ${perc}%;"></div></div></li>`; 
    });
    document.getElementById('lista_top_receitas').innerHTML = hR || '<li class="item-lista-grafico" style="cursor:default;">Nenhuma receita paga</li>';

    let arrDCat = Object.entries(dCat).sort((a,b) => b[1] - a[1]).slice(0, 5); let maxDCat = arrDCat.length > 0 ? arrDCat[0][1] : 0; let hD = '';
    arrDCat.forEach(x => { 
        let perc = maxDCat > 0 ? (x[1] / maxDCat) * 100 : 0; let codeStr = encodeURIComponent(x[0]); 
        hD += `<li class="item-lista-grafico" onclick="abrirDetalheCategoria('${codeStr}', 'Saida')" title="Clique para ver detalhes"><div style="display:flex; justify-content:space-between;"><span>${strEscape(x[0])}</span> <span>${formatarMoeda(x[1])}</span></div><div class="barra-grafico-container"><div class="barra-grafico-despesa" style="width: ${perc}%;"></div></div></li>`; 
    });
    document.getElementById('lista_top_despesas').innerHTML = hD || '<li class="item-lista-grafico" style="cursor:default;">Nenhuma saída paga</li>';
}

function atualizarFiltrosRelatorios() {
    atualizarRelatoriosDetalhados();
    if(document.getElementById('rel_view_cascata').classList.contains('active')) {
        renderCascata();
    }
}

function atualizarRelatoriosDetalhados() {
    let despSetor = {}; let despCat = {}; let invCat = {}; let recCat = {}; let recLocal = {};
    const filtroMes = safeVal('filtro_mes_relatorios'); const filtroSafra = safeVal('filtro_safra_relatorios');

    transacoes.forEach(t => {
        if (t.deleted) return;
        let sit = strSafe(t.sit).toLowerCase(); if (!sit.includes('pago')) return; 
        if (filtroSafra && obterSafraGeral(t.data) !== filtroSafra) return;
        if (filtroMes && (!t.data || !sanitizeDateString(t.data).startsWith(filtroMes))) return;

        let v = parseFloat(t.valor) || 0; let tipo = String(t.tipo).toLowerCase();
        let cat = strSafe(t.categoria).toUpperCase();
        if (!cat || cat === '-' || cat === 'SEM CATEGORIA') cat = (tipo === 'receita') ? strSafe(t.desc).toUpperCase() : strSafe(t.setor).toUpperCase();
        if (!cat || cat === '-') cat = "SEM CATEGORIA";
        let loc = strSafe(t.local).toUpperCase() || 'NÃO INFORMADO'; let setor = strSafe(t.setor).toUpperCase() || 'SEM SETOR';

        if (tipo === 'despesa') { despSetor[setor] = (despSetor[setor] || 0) + v; despCat[cat] = (despCat[cat] || 0) + v; } 
        else if (tipo === 'investimento') { invCat[cat] = (invCat[cat] || 0) + v; } 
        else if (tipo === 'receita') { recCat[cat] = (recCat[cat] || 0) + v; recLocal[loc] = (recLocal[loc] || 0) + v; }
    });

    function renderTabelaRel(id, dadosObj, cor) {
        let html = ''; let totalSoma = 0;
        Object.entries(dadosObj).sort((a,b) => b[1] - a[1]).forEach(item => { html += `<tr><td>${strEscape(item[0])}</td><td style="font-weight:700; font-family:'Rubik'; color:${cor}; text-align:right;">${formatarMoeda(item[1])}</td></tr>`; totalSoma += item[1]; });
        if (html !== '') html += `<tr style="background-color: #f0f0f0; border-top: 2px solid ${cor};"><td style="font-weight:700;">TOTAL</td><td style="font-weight:700; font-family:'Rubik'; color:${cor}; text-align:right;">${formatarMoeda(totalSoma)}</td></tr>`;
        else html = '<tr><td colspan="2" style="text-align:center; color:#aaa;">Nenhum dado</td></tr>';
        if(document.getElementById(id)) document.getElementById(id).innerHTML = html;
    }

    renderTabelaRel('tbody_gastos_setor', despSetor, 'var(--cor-laranja-flat)');
    renderTabelaRel('tbody_gastos_categoria', despCat, '#f39c12');
    renderTabelaRel('tbody_investimentos_categoria', invCat, 'var(--cor-roxo-flat)');
    renderTabelaRel('tbody_receitas_categoria', recCat, 'var(--cor-verde-flat)');
    renderTabelaRel('tbody_receitas_local', recLocal, '#16a085');
}

function switchRelTab(mode) {
    ['tabelas', 'cascata', 'custos'].forEach(m => {
        const v = document.getElementById('rel_view_' + m), b = document.getElementById('btn_rel_' + m);
        if (v) v.classList.toggle('active', m === mode); if (b) b.classList.toggle('active', m === mode);
    });
    const fc = document.getElementById('rel_filtros_comuns'); if (fc) fc.style.display = mode === 'custos' ? 'none' : '';
    if (mode === 'cascata') renderCascataCategorias();
    if (mode === 'custos') popularCustosTalhaoSafra();
}

function switchTab(id) { showTab(id); }

function mudarTemaSaida() {
    const select = document.getElementById('d_natureza'); const caixa = document.getElementById('caixa_lancamento_saida'); const titulo = document.getElementById('titulo_saida');
    if (!select || !caixa) return;
    const inv = select.value === 'Investimento';
    caixa.classList.toggle('modal-borda-invest', inv); caixa.classList.toggle('modal-borda-despesa', !inv);
    const cor = inv ? 'var(--cor-roxo-flat)' : 'var(--cor-laranja-flat)';
    if (titulo) titulo.style.color = cor; select.style.color = cor;
}

function addTransacao(e, tipoBase) {
    e.preventDefault(); 
    try {
        const prefix = tipoBase === 'Saida' ? 'd_' : 'r_';
        // Os campos só aceitam itens da tela Cadastros
        const checagens = tipoBase === 'Saida'
            ? [['d_categoria', 'categoria_despesa', 'Categoria'], ['d_setor', 'setor', 'Setor'], ['d_und', 'unidade', 'Unidade'], ['d_talhao', 'talhao', 'Talhão'], ['d_talhao2', 'talhao', 'Talhão 2'], ['d_talhao3', 'talhao', 'Talhão 3'], ['d_talhao4', 'talhao', 'Talhão 4'], ['d_local', 'fornecedor', 'Fornecedor']]
            : [['r_categoria', 'produto_receita', 'Produto'], ['r_local', 'cliente', 'Cliente'], ['r_talhao', 'talhao', 'Talhão'], ['r_und', 'unidade', 'Unidade']];
        const falhas = checagens.filter(c => { const v = cadNorm(safeVal(c[0])); return v && !cadTem(c[1], v); }).map(c => `• ${c[2]}: ${cadNorm(safeVal(c[0]))}`);
        if (falhas.length) { alert("Os itens abaixo não estão cadastrados:\n\n" + falhas.join("\n") + "\n\nCadastre-os na tela Cadastros e tente novamente."); return; }
        if (tipoBase === 'Saida' && !setorValidoParaCategoria(safeVal('d_categoria'), safeVal('d_setor'))) { alert(`O setor "${cadNorm(safeVal('d_setor'))}" não pertence à categoria "${cadNorm(safeVal('d_categoria'))}".\n\nEscolha um setor da categoria ou vincule-o na tela Cadastros.`); return; }
        if (!cadNorm(safeVal(prefix + 'categoria')) || !cadNorm(safeVal(prefix + 'local')) || (tipoBase === 'Saida' && !cadNorm(safeVal('d_setor')))) { alert("Preencha todos os campos obrigatórios com itens cadastrados."); return; }
        let data = sanitizeDateString(document.getElementById(prefix + 'data').value);
        let cat = document.getElementById(prefix + 'categoria').value.trim().toUpperCase();
        let loc = document.getElementById(prefix + 'local').value.trim().toUpperCase();
        let qtd = document.getElementById(prefix + 'qtd').value;
        let und = document.getElementById(prefix + 'und').value.trim().toUpperCase();
        let vUnit = document.getElementById(prefix + 'v_unit').value;
        let valStr = document.getElementById(prefix + 'valor').value; let val = parseFloat(valStr);

        let setor = "-"; let desc = document.getElementById(prefix + 'descricao').value.trim().toUpperCase();
        let tipoFinal = 'Receita';
        
        if(tipoBase === 'Saida') {
            tipoFinal = document.getElementById('d_natureza').value; 
            setor = document.getElementById('d_setor').value.trim().toUpperCase();
        }

        // Talhão (nas saídas, o custo pode ser distribuído entre até 4 talhões)
        let talhao = strSafe(safeVal(prefix + 'talhao')).toUpperCase(); let talhao2 = ''; let pct = 100; let listaRt = null;
        if (tipoBase === 'Saida') {
            const rt = lerRateio('d_'); if (rt.erro) { alert(rt.erro); return; }
            const conf = conflitoSetorTalhao(setor, rt.lista.map(x => x.talhao)); if (conf) { alert(conf); return; }
            listaRt = rt.lista; talhao = listaRt[0] ? listaRt[0].talhao : ''; talhao2 = listaRt[1] ? listaRt[1].talhao : ''; pct = listaRt.length >= 2 ? listaRt[0].pct : 100;
        }
        const nova = { id: generateUUID(), updatedAt: Date.now(), deleted: false, data: data, tipo: tipoFinal, categoria: cat, setor: setor, talhao: talhao, talhao2: talhao2, pct: pct, local: loc, desc: desc, qtd: qtd, und: und, v_unit: parseFloat(vUnit), valor: val, sit: document.getElementById(prefix + 'sit').value || 'Pago', obs: '' };
        if (listaRt) gravarRateioNaTransacao(nova, listaRt);
        transacoes.push(nova);

        // Compra de insumo: oferece dar entrada no estoque (custo médio ponderado)
        let avisoEstoque = '';
        if (tipoBase === 'Saida' && categoriasInsumo.includes(cat) && parseFloat(qtd) > 0 && desc && val > 0) {
            const conv = normalizarUnidadeEstoque(und, parseFloat(qtd));
            if (!conv || conv.qtd <= 0) {
                avisoEstoque = ` (unidade "${und || '?'}" não reconhecida: sem entrada no estoque)`;
            } else if (confirm(`Dar entrada no estoque?\n\n${desc}\n${conv.qtd.toFixed(2)} ${conv.un} a ${formatarMoeda(val / conv.qtd)}/${conv.un}`)) {
                const tipoEst = cat; verificarNovaOpcao('tipos', tipoEst);
                nova.est_mov = { id: entradaEstoque(desc, '', tipoEst, conv.qtd, conv.un, val / conv.qtd), qtd: conv.qtd, un: conv.un }; gravarRateioNaTransacao(nova, []);
                renderDatalistsAgri(); avisoEstoque = ' + ESTOQUE';
            }
        }

        salvarDados();

        document.getElementById(tipoBase === 'Saida' ? 'caixa_form_saida' : 'caixa_form_receita').reset();
        setVal(prefix + 'data', hojeLocal()); revalidarCadastros(); try { atualizarSomaRateio('d_'); } catch (e2) {}
        preencherSelectsSafraFin(); atualizarOpcoesFiltros(); aplicarFiltros(); preencherSelectsLancamento();
        mostrarToast(tipoFinal.toUpperCase() + ' GRAVADA!' + avisoEstoque);
        if (modalFecharApos) fecharModalLancamento(tipoBase === 'Saida' ? 'despesa' : 'receita');
        focarPrimeiroCampo(prefix + 'data');
        modalFecharApos = false;
    } catch (error) { alert("Erro ao gravar: " + error.message); }
}

function renderizarTabelasPendencias() {
    let htmlRec = ''; let htmlDesp = ''; let tRec = 0; let tDesp = 0;
    let pendentes = transacoes.filter(t => { 
        let sit = strSafe(t.sit).toLowerCase(); return !t.deleted && (sit.includes('pagar') || sit.includes('receber') || sit.includes('pendente')); 
    }).sort((a, b) => new Date(sanitizeDateString(a.data)) - new Date(sanitizeDateString(b.data)));

    pendentes.forEach(t => {
        let v = parseFloat(t.valor) || 0; let dF = formatarData(t.data); let tipoL = String(t.tipo).toLowerCase();
        if (tipoL === 'receita') {
            htmlRec += `<tr><td>${dF}</td><td>${strEscape(t.local)}</td><td style="font-weight:700; color:var(--cor-azul-flat); text-align:right;">${formatarMoeda(v)}</td>
                <td style="text-align: center;"><button class="btn-acao bg-pago" onclick="mudarSitEAtualizarPendencias('${t.id}', 'Pago')">✔️ Receber</button></td></tr>`;
            tRec += v;
        } else {
            htmlDesp += `<tr><td>${dF}</td><td>${strEscape(t.local)}</td><td style="font-weight:700; color:var(--cor-vermelho-flat); text-align:right;">${formatarMoeda(v)}</td>
                <td style="text-align: center;"><button class="btn-acao bg-pago" onclick="mudarSitEAtualizarPendencias('${t.id}', 'Pago')">✔️ Pagar</button></td></tr>`;
            tDesp += v;
        }
    });
    document.getElementById('tbody_receitas_pendentes').innerHTML = htmlRec || '<tr><td colspan="4" style="text-align:center; padding: 20px; color:#aaa;">Nenhuma pendência!</td></tr>';
    document.getElementById('tbody_despesas_pendentes').innerHTML = htmlDesp || '<tr><td colspan="4" style="text-align:center; padding: 20px; color:#aaa;">Nenhuma pendência!</td></tr>';
}

function mudarSitEAtualizarPendencias(id, novaSit) { let t = transacoes.find(x => x.id === id); if(t) { t.sit = novaSit; t.updatedAt = Date.now(); salvarDados(); aplicarFiltros(); renderizarTabelasPendencias(); mostrarToast("Liquidada!"); } }
function mudarSitTransacao(id, novaSit) { let t = transacoes.find(x => x.id === id); if(t) { t.sit = novaSit; t.updatedAt = Date.now(); salvarDados(); aplicarFiltros(); if(document.getElementById('resumo').classList.contains('active')) atualizarResumoEGrafico(); } }

function autoPreencherUnidade() { const cat = document.getElementById('r_categoria').value.trim().toUpperCase(); if (unidadesReceita[cat]) document.getElementById('r_und').value = unidadesReceita[cat]; }

function preencherSelectsLancamento() {
    const dDescs = new Set();
    transacoes.forEach(t => { if (t && !t.deleted && String(t.tipo).toLowerCase() !== 'receita' && strSafe(t.desc)) dDescs.add(strSafe(t.desc).toUpperCase()); });
    const montar = (id, arr) => { const dl = document.getElementById(id); if (dl) dl.innerHTML = Array.from(arr).map(v => `<option value="${strEscape(v)}">`).join(''); };
    montar('lista_d_categoria', cadLista('categoria_despesa')); montar('lista_d_setor', cadLista('setor')); montar('lista_d_local', cadLista('fornecedor'));
    montar('lista_r_categoria', cadLista('produto_receita')); montar('lista_r_local', cadLista('cliente')); montar('lista_unidades', cadLista('unidade'));
    montar('lista_d_descricao', Array.from(dDescs).sort());
    renderDatalistsAgri(); try { atualizarSetoresDaCategoria('d_'); } catch (e) {}
}

function calcularTotalReceita() { let q = parseFloat(document.getElementById('r_qtd').value) || 0; let v = parseFloat(document.getElementById('r_v_unit').value) || 0; if (q>0 && v>0) document.getElementById('r_valor').value = (q * v).toFixed(2); }
function calcularTotalDespesa() { let q = parseFloat(document.getElementById('d_qtd').value) || 0; let v = parseFloat(document.getElementById('d_v_unit').value) || 0; if (q>0 && v>0) document.getElementById('d_valor').value = (q * v).toFixed(2); }

function confirmarExclusao(id) { 
    if(confirm('EXCLUIR lançamento?')) { 
        let t = transacoes.find(x => x.id === id);
        if(t) {
            if (t.est_mov && confirm(`Este lançamento deu entrada de ${Number(t.est_mov.qtd).toFixed(2)} ${t.est_mov.un} no estoque.\nRemover essa entrada do estoque também?`)) {
                const est = estoque.find(e => e && e.id === t.est_mov.id);
                if (est) { est.qtd = (parseFloat(est.qtd) || 0) - t.est_mov.qtd; est.updatedAt = Date.now(); }
            }
            t.deleted = true; t.updatedAt = Date.now(); salvarDados(); preencherSelectsSafraFin(); preencherSelectsLancamento(); atualizarOpcoesFiltros(); aplicarFiltros(); mostrarToast("REMOVIDO!"); }
    } 
}

function abrirModalEdicao(id) {
    const t = transacoes.find(x => x.id === id); if(!t || t.deleted) return;
    document.getElementById('modal-edicao').dataset.editId = id; 
    
    let vCat = strEscape(t.categoria); let vSet = strEscape(t.setor); let vLoc = strEscape(t.local); let vDesc = strEscape(t.desc);
    let tipoLowerT = String(t.tipo).toLowerCase(); const ehRec = tipoLowerT === 'receita';
    let htmlSel = ehRec ? `<input type="hidden" id="ed_tipo" value="Receita">` : `
        <div><label>TIPO:</label><select id="ed_tipo"><option value="Despesa" ${tipoLowerT === 'despesa' ? 'selected' : ''}>CUSTEIO</option><option value="Investimento" ${tipoLowerT === 'investimento' ? 'selected' : ''}>INVESTIMENTO</option></select></div>`;

    let sitPago = strSafe(t.sit).toLowerCase().includes('pago') ? 'selected' : '';
    let sitPagar = (!sitPago && !ehRec) ? 'selected' : '';
    let sitReceber = (!sitPago && ehRec) ? 'selected' : '';
    
    let selectSit = ehRec ? 
        `<option value="A receber" ${sitReceber}>A RECEBER</option><option value="Pago" ${sitPago}>PAGO</option>` :
        `<option value="A pagar" ${sitPagar}>A PAGAR</option><option value="Pago" ${sitPago}>PAGO</option>`;

    const vUnd = strEscape(t.und);
    const cabEd = `<div class="f2"><label>DATA:</label> <input type="date" id="ed_data" value="${sanitizeDateString(t.data)}"></div>`;
    const campoCat = `<input type="text" id="ed_categoria" list="${ehRec ? 'lista_r_categoria' : 'lista_d_categoria'}" data-orig="${vCat}" value="${vCat}" autocomplete="off" ${ehRec ? '' : `oninput="aoMudarCategoria('ed_')" onchange="aoMudarCategoria('ed_')"`}>`;
    const rodape = `<div class="f3"><label>QTD:</label> <input type="number" id="ed_qtd" step="0.01" value="${parseFloat(t.qtd)||0}"></div>
        <div class="f3"><label>UNID:</label> <input type="text" id="ed_und" list="lista_unidades" data-orig="${vUnd}" value="${vUnd}" autocomplete="off"></div>
        <div class="f3"><label>VALOR TOTAL:</label> <input type="number" id="ed_valor" step="0.01" value="${parseFloat(t.valor)||0}"></div>
        <div class="f3"><label>SITUAÇÃO:</label> <select id="ed_sit">${selectSit}</select></div>`;
    document.getElementById('form-edicao').innerHTML = ehRec ? `
        ${cabEd}${htmlSel}
        <div class="f5"><label>PRODUTO:</label> ${campoCat}</div>
        <div class="f5"><label>CLIENTE:</label> <input type="text" id="ed_local" list="lista_r_local" data-orig="${vLoc}" value="${vLoc}" autocomplete="off"></div>
        <div class="f4"><label>TALHÃO:</label> <input type="text" id="ed_talhao" list="lista-talhoes" data-orig="${strEscape(t.talhao)}" value="${strEscape(t.talhao)}" autocomplete="off"></div>
        <div class="f8"><label>DESCRIÇÃO:</label> <input type="text" id="ed_desc" value="${vDesc}"></div>
        ${rodape}` : `
        ${cabEd}<div class="f2">${htmlSel.replace(/^\s*<div>|<\/div>\s*$/g, '')}</div>
        <div class="f4"><label>CATEGORIA:</label> ${campoCat}</div>
        <div class="f4"><label>SETOR:</label> <input type="text" id="ed_setor" list="lista_ed_setor" data-orig="${vSet}" value="${vSet}" autocomplete="off" placeholder="Escolha a categoria"></div>
        <div class="f12">${htmlRateio('ed_', rateioDe(t))}</div>
        <div class="f6"><label>FORNECEDOR:</label> <input type="text" id="ed_local" list="lista_d_local" data-orig="${vLoc}" value="${vLoc}" autocomplete="off"></div>
        <div class="f6"><label>DESCRIÇÃO:</label> <input type="text" id="ed_desc" value="${vDesc}"></div>
        ${rodape}`;
    atualizarSetoresDaCategoria('ed_');
    preencherSelectsLancamento(); converterListasEmCombo(document.getElementById('form-edicao'));
    document.getElementById('modal-edicao').style.display = 'flex';
}

function fecharModal() { document.getElementById('modal-edicao').style.display = 'none'; }
function guardarEdicao() {
    const id = document.getElementById('modal-edicao').dataset.editId;
    const t = transacoes.find(x => x.id === id); if (!t) return;
    const ehRec = String(t.tipo).toLowerCase() === 'receita';
    // Itens novos ou alterados precisam estar cadastrados (valores antigos já gravados podem ser mantidos)
    const campos = ehRec
        ? [['ed_categoria', 'produto_receita', 'Produto'], ['ed_local', 'cliente', 'Cliente'], ['ed_talhao', 'talhao', 'Talhão'], ['ed_und', 'unidade', 'Unidade']]
        : [['ed_categoria', 'categoria_despesa', 'Categoria'], ['ed_setor', 'setor', 'Setor'], ['ed_talhao', 'talhao', 'Talhão'], ['ed_talhao2', 'talhao', 'Talhão 2'], ['ed_talhao3', 'talhao', 'Talhão 3'], ['ed_talhao4', 'talhao', 'Talhão 4'], ['ed_local', 'fornecedor', 'Fornecedor'], ['ed_und', 'unidade', 'Unidade']];
    const falhas = [];
    campos.forEach(c => {
        const el = document.getElementById(c[0]); if (!el) return;
        const v = cadNorm(el.value); const orig = cadNorm(el.dataset.orig || '');
        if (v && v !== orig && !cadTem(c[1], v)) falhas.push(`• ${c[2]}: ${v}`);
    });
    if (!ehRec && document.getElementById('ed_setor')) {
        const elC = document.getElementById('ed_categoria'), elS = document.getElementById('ed_setor'); const cE = cadNorm(elC.value), sE = cadNorm(elS.value);
        if ((cE !== cadNorm(elC.dataset.orig || '') || sE !== cadNorm(elS.dataset.orig || '')) && !setorValidoParaCategoria(cE, sE)) falhas.push(`• Setor: "${sE}" não pertence à categoria "${cE}"`);
    }
    if (falhas.length) { alert("Corrija os itens abaixo:\n\n" + falhas.join("\n") + "\n\nCadastre ou vincule na tela Cadastros e tente novamente."); return; }

    let rtEd = null; if (document.getElementById('ed_talhao2')) { rtEd = lerRateio('ed_'); if (rtEd.erro) { alert(rtEd.erro); return; } if (!ehRec && document.getElementById('ed_setor')) { const confE = conflitoSetorTalhao(document.getElementById('ed_setor').value.trim().toUpperCase(), rtEd.lista.map(x => x.talhao)); if (confE) { alert(confE); return; } } }
    const gv = i => { const el = document.getElementById(i); return el ? el.value.trim().toUpperCase() : null; };
    t.data = sanitizeDateString(document.getElementById('ed_data').value); t.tipo = document.getElementById('ed_tipo').value;
    t.categoria = gv('ed_categoria') || ''; if (document.getElementById('ed_setor')) t.setor = gv('ed_setor') || '-';
    t.local = gv('ed_local') || ''; t.desc = gv('ed_desc') || '';
    t.qtd = document.getElementById('ed_qtd').value; t.und = gv('ed_und') || '';
    t.valor = parseFloat(document.getElementById('ed_valor').value) || 0; t.sit = document.getElementById('ed_sit').value;
    if (rtEd) gravarRateioNaTransacao(t, rtEd.lista); else t.talhao = gv('ed_talhao') || '';
    t.updatedAt = Date.now();
    salvarDados(); fecharModal(); preencherSelectsSafraFin(); preencherSelectsLancamento(); atualizarOpcoesFiltros(); aplicarFiltros();
}

function atualizarOpcoesFiltros() {
    let cats = new Set(), sets = new Set(), locs = new Set(), descs = new Set(), talhs = new Set();
    transacoes.forEach(t => {
        if(t.deleted) return;
        let cat = strSafe(t.categoria); if (!cat || cat === '-') cat = (String(t.tipo).toLowerCase() === 'receita') ? strSafe(t.desc) : strSafe(t.setor);
        if(cat && cat !== '-') cats.add(String(cat).toUpperCase());
        if(strSafe(t.setor) && t.setor !== '-') sets.add(strSafe(t.setor).toUpperCase());
        if(strSafe(t.local) && t.local !== '-') locs.add(strSafe(t.local).toUpperCase());
        if(strSafe(t.desc) && t.desc !== '-') descs.add(strSafe(t.desc).toUpperCase());
        talhoesDe(t).forEach(x => talhs.add(x));
    });
    function preencher(id, setVals) { const sel = document.getElementById(id); if(sel) { const val = sel.value; sel.innerHTML = '<option value="">TUDO</option>' + Array.from(setVals).sort().map(v => `<option value="${strEscape(v.toLowerCase())}">${strEscape(v)}</option>`).join(''); sel.value = val; } }
    preencher('f_cat', cats); preencher('f_setor', sets); preencher('f_talhao', talhs); preencher('f_local', locs); preencher('f_desc', descs);
}

function limparFiltros() { document.querySelectorAll('.filter-bar input:not([type="button"]), .filter-row input, .filter-row select').forEach(i => i.value = ''); setFiltroRapido(''); }

function setFiltroRapido(tipo) {
    filtroRapido = tipo; 
    document.getElementById('btn_f_todos').style.opacity = tipo === '' ? '1' : '0.5';
    document.getElementById('btn_f_safra').style.opacity = tipo === 'safra' ? '1' : '0.5';
    aplicarFiltros();
}

function setOrdenacao(coluna) { colOrdenacao = coluna; ordemAscendente = !ordemAscendente; aplicarFiltros(); }

function aplicarFiltros() {
    const pE = document.getElementById('pesquisa_global'); const pG = pE ? pE.value.toLowerCase() : '';
    const dE = document.getElementById('f_data'); const fD = dE ? sanitizeDateString(dE.value) : ''; 
    const tE = document.getElementById('f_tipo'); const fT = tE ? tE.value.toLowerCase() : '';
    const cE = document.getElementById('f_cat'); const fC = cE ? cE.value.toLowerCase() : ''; 
    const sE = document.getElementById('f_setor'); const fSe = sE ? sE.value.toLowerCase() : '';
    const lE = document.getElementById('f_local'); const fL = lE ? lE.value.toLowerCase() : ''; 
    const deE = document.getElementById('f_desc'); const fDe = deE ? deE.value.toLowerCase() : '';
    const siE = document.getElementById('f_sit'); const fSi = siE ? siE.value.toLowerCase() : '';
    const tlE = document.getElementById('f_talhao'); const fTl = tlE ? tlE.value.toLowerCase() : '';

    let lista = transacoes.filter(t => {
        if(t.deleted) return false;
        let cM = strSafe(t.categoria); if (!cM || cM === '-') cM = (String(t.tipo).toLowerCase() === 'receita') ? strSafe(t.desc) : strSafe(t.setor);
        if(pG && !`${strSafe(t.desc)} ${strSafe(t.local)} ${cM} ${strSafe(t.setor)} ${talhoesDe(t).join(' ')} ${t.tipo}`.toLowerCase().includes(pG)) return false;
        if(fD && sanitizeDateString(t.data) !== fD) return false;
        if(fT && String(t.tipo).toLowerCase() !== fT) return false;
        if(fC && cM.toLowerCase() !== fC) return false;
        if(fSe && strSafe(t.setor).toLowerCase() !== fSe) return false;
        if(fL && strSafe(t.local).toLowerCase() !== fL) return false;
        if(fDe && strSafe(t.desc).toLowerCase() !== fDe) return false;
        if(fSi && strSafe(t.sit).toLowerCase() !== fSi) return false;
        if(fTl && !talhoesDe(t).some(x => x.toLowerCase() === fTl)) return false;
        if (filtroRapido === 'safra' && obterSafraGeral(t.data) !== obterSafraAtual()) return false;
        return true;
    });

    lista.sort((a, b) => {
        let vA = a[colOrdenacao], vB = b[colOrdenacao];
        if (colOrdenacao === 'categoria') { vA = vA === '-' ? a.desc : vA; vB = vB === '-' ? b.desc : vB; }
        if(colOrdenacao === 'valor' || colOrdenacao === 'qtd' || colOrdenacao === 'v_unit') { vA = parseFloat(vA)||0; vB = parseFloat(vB)||0; } 
        else if(colOrdenacao === 'data') { vA = new Date(sanitizeDateString(vA)).getTime()||0; vB = new Date(sanitizeDateString(vB)).getTime()||0; } 
        else { vA = String(vA).toLowerCase(); vB = String(vB).toLowerCase(); }
        if(vA < vB) return ordemAscendente ? -1 : 1; if(vA > vB) return ordemAscendente ? 1 : -1; return 0;
    });
    
    ultimaListaFiltrada = lista;
    let linhasHTML = []; const hojeObj = new Date(hojeLocal() + 'T00:00:00');
    lista.forEach(t => {
        try {
            if(!t) return;
            let tipoLower = String(t.tipo).toLowerCase();
            let badgeTipo = tipoLower === 'despesa' ? 'badge-despesa' : (tipoLower === 'investimento' ? 'badge-investimento' : 'badge-receita');
            let sitTxt = strSafe(t.sit).toLowerCase(); let isPago = sitTxt.includes('pago');
            let btnSit = isPago 
                ? `<button class="bg-pago" onclick="mudarSitTransacao('${t.id}', '${tipoLower === 'receita'?'A receber':'A pagar'}')">✔️ PAGO</button>` 
                : `<button class="bg-pendente" onclick="mudarSitTransacao('${t.id}', 'Pago')">⏳ PENDENTE</button>`;
            let isAtrasado = (!isPago) && (t.data && new Date(String(sanitizeDateString(t.data)) + 'T00:00:00') < hojeObj);
            let cM = strSafe(t.categoria); if (!cM || cM === '-') cM = (tipoLower === 'receita') ? strSafe(t.desc) : strSafe(t.setor);

            linhasHTML.push(`
                <tr class="${isAtrasado ? 'tr-alerta' : ''}"${(!isAtrasado && rateioDe(t).length === 1) ? estiloLinhaTalhao(rateioDe(t)[0].talhao) : ''}>
                    <td>${formatarData(t.data)}</td><td><div class="badge-tipo ${badgeTipo}">${String(t.tipo).toUpperCase()}</div></td><td><b style="color:var(--cor-texto); font-weight:700;">${strEscape(cM)}</b></td>
                    <td>${strEscape(t.setor)}</td><td>${rotuloTalhao(t)}</td><td>${strEscape(t.local)}</td><td>${strEscape(t.desc)}</td>
                    <td>${strSafe(t.qtd)} ${strEscape(t.und)}</td><td>${formatarMoeda(t.v_unit)}</td>
                    <td style="font-weight:700; font-family:'Rubik'; color:var(--cor-texto);">${formatarMoeda(t.valor)}</td><td style="text-align: center; width: 100px;">${btnSit}</td>
                    <td class="no-print" style="text-align: center;">
                        <button onclick="abrirModalEdicao('${t.id}')" class="btn-acao btn-editar">✏️</button>
                        <button onclick="confirmarExclusao('${t.id}')" class="btn-acao btn-excluir">🗑️</button>
                    </td>
                </tr>`);
        } catch(e) {}
    });
    document.getElementById('tabela_relatorio').innerHTML = linhasHTML.join('') || '<tr><td colspan="12" style="text-align:center; padding: 30px; color:#aaa;">Sem lançamentos</td></tr>';
}

/* -------------------------------------------------------------------------
   7. BLOCO AGRÍCOLA E ESTOQUE 
------------------------------------------------------------------------- */
function preencherTipoProduto() { const prod = document.getElementById('produto').value.toUpperCase(); const item = estoque.find(e => e && !e.deleted && e.produto === prod); if (item && item.tipo) setVal('tipo', item.tipo); }

function popularSeletorSafraApp() {
    const selector = document.getElementById('safraSelector'); if(!selector) return;
    const currentSelection = selector.value || obterSafraAtual();
    const safras = new Set(); safras.add(obterSafraAtual());
    agriRecords.forEach(rec => { if(rec && !rec.deleted && rec.data) safras.add(obterSafraGeral(rec.data)) });
    
    let htmlSafras = '<option value="TODAS">TODAS AS SAFRAS</option>' + Array.from(safras).sort().reverse().map(s => `<option value="${s}">${s}</option>`).join('');
    setHtml('safraSelector', htmlSafras);
    setVal('safraSelector', Array.from(safras).includes(currentSelection) ? currentSelection : "TODAS");
    
    setHtml('safraDashboardSelector', htmlSafras);
    setHtml('talhaoDashboardSelector', '<option value="TODOS">TODOS OS TALHÕES</option>' + (opcoesDin.talhoes||[]).map(t => `<option value="${strEscape(t)}">${strEscape(t)}</option>`).join(''));
}

function aplicarFiltroSafraApp() { saveAndRenderApp(); saveAndRenderEstoque(); if (document.getElementById('agri_dash').classList.contains('active')) renderAgriDashboard(); }

function renderDatalistsAgri() {
    setHtml('lista-talhoes', (opcoesDin.talhoes||[]).map(t => `<option value="${strEscape(t)}">`).join(''));
    setHtml('lista-tipos', (opcoesDin.tipos||[]).map(t => `<option value="${strEscape(t)}">`).join(''));
    setHtml('lista-formas', (opcoesDin.formas||[]).map(t => `<option value="${strEscape(t)}">`).join(''));
    setHtml('lista-alvos', (opcoesDin.alvos||[]).map(t => `<option value="${strEscape(t)}">`).join(''));
    setHtml('lista-produtos-estoque', [...new Set(estoque.filter(e => e && !e.deleted && e.produto).map(e => e.produto))].sort().map(p => `<option value="${strEscape(p)}">`).join(''));
}

function verificarNovaOpcao(categoria, valorStr) {
    let valor = String(valorStr||'').toUpperCase().trim();
    garantirOpcoes();
    if (categoria === 'talhoes') {
        // Talhões vivem no cadastro (com controle de remoção)
        if (valor && valor !== '-' && !cadTem('talhao', valor)) { cadAdicionar('talhao', valor); renderDatalistsAgri(); }
        return valor || '-';
    }
    if(!opcoesDin[categoria]) opcoesDin[categoria] = [];
    if (valor && valor !== '-' && !opcoesDin[categoria].includes(valor)) {
        opcoesDin[categoria].push(valor); 
        opcoesDin[categoria].sort(); 
        renderDatalistsAgri(); 
    } 
    return valor || '-';
}

function addAgriApp(e) {
    e.preventDefault();
    try {
        let produtoStr = document.getElementById('produto').value.toUpperCase(); 
        let dosagemQtd = parseFloat(document.getElementById('dosagem_qtd').value); 
        let dosagemUn = document.getElementById('dosagem_un').value; 
        let tipoStr = verificarNovaOpcao('tipos', document.getElementById('tipo').value);
        let novoStatus = document.getElementById('status').value.toUpperCase();
        let dataLimpa = sanitizeDateString(document.getElementById('dataApp').value);
        
        const record = { 
            id: generateUUID(), 
            updatedAt: Date.now(), 
            deleted: false, 
            data: dataLimpa, 
            talhao: verificarNovaOpcao('talhoes', document.getElementById('talhao').value), 
            produto: produtoStr, 
            tipo: tipoStr, 
            alvo: verificarNovaOpcao('alvos', document.getElementById('alvo').value), 
            dosagem: `${dosagemQtd} ${dosagemUn}`, 
            dosagem_qtd: dosagemQtd, 
            dosagem_un: dosagemUn, 
            forma: verificarNovaOpcao('formas', document.getElementById('forma').value), 
            status: novoStatus, 
            custo_unit: 0 
        };
        
        const editId = document.getElementById('editAgriIndex').value;
        
        if (!editId) {
            if (record.status === 'APLICADO') congelarCusto(record);
            agriRecords.push(record);
            if (record.status === 'APLICADO' && record.data <= hojeLocal()) {
                let est = estoque.find(e => e && !e.deleted && e.produto === record.produto && e.un === record.dosagem_un);
                if (est) { est.qtd -= record.dosagem_qtd; est.updatedAt = Date.now(); }
                else estoque.push({ id: generateUUID(), updatedAt: Date.now(), deleted: false, produto: record.produto, principio: "", tipo: record.tipo, qtd: -record.dosagem_qtd, un: record.dosagem_un, valor_unit: 0 });
            }
        } else { 
            let old = agriRecords.find(r => r.id === editId);
            if(old) {
                if (old.status === 'APLICADO' && sanitizeDateString(old.data) <= hojeLocal()) {
                    let est = estoque.find(e => e && !e.deleted && e.produto === old.produto && e.un === old.dosagem_un);
                    if(est) { est.qtd += old.dosagem_qtd; est.updatedAt = Date.now(); } 
                }
                
                record.id = old.id;
                record.custo_unit = old.custo_unit; record.custo_fixo = old.custo_fixo;
                if (record.status === 'APLICADO') { if (!(old.status === 'APLICADO' && old.custo_fixo && old.produto === record.produto && old.dosagem_un === record.dosagem_un)) congelarCusto(record); } else { record.custo_fixo = false; } 
                let idx = agriRecords.indexOf(old);
                agriRecords[idx] = record; 
                
                if (record.status === 'APLICADO' && record.data <= hojeLocal()) {
                    let est = estoque.find(e => e && !e.deleted && e.produto === record.produto && e.un === record.dosagem_un);
                    if(est) { est.qtd -= record.dosagem_qtd; est.updatedAt = Date.now(); }
                }
            }
            document.getElementById('editAgriIndex').value = ""; 
        }
        
        salvarDados(); 
        popularSeletorSafraApp(); 
        
        const ss = document.getElementById('safraSelector'); 
        if(ss) { ss.value = obterSafraGeral(record.data); }
        
        aplicarFiltroSafraApp();
        limparFiltrosAgri();
        
        document.getElementById('appForm').reset(); 
        const st = document.getElementById('status'); 
        if(st) st.value = 'PLANEJADO'; 
        
        esconderSugestoesProduto();
        mostrarToast("Registro Agrícola Salvo!");
        focarPrimeiroCampo('dataApp');
        
    } catch (err) {
        alert("Ops! Ocorreu um erro ao salvar o registro na tela: " + err.message);
    }
}

function toggleStatusApp(id) {
    const rec = agriRecords.find(r => r.id === id); if(!rec) return;
    const newStatus = rec.status === 'PLANEJADO' ? 'APLICADO' : 'PLANEJADO';
    const dataAppLocal = sanitizeDateString(rec.data);
    
    if (newStatus === 'APLICADO' && dataAppLocal > hojeLocal()) { alert("Data no futuro. Altere para baixar no estoque."); return; }

    rec.status = newStatus; rec.updatedAt = Date.now(); if (newStatus === 'APLICADO') congelarCusto(rec); else rec.custo_fixo = false;
    if (dataAppLocal <= hojeLocal()) {
        let est = estoque.find(e => e && !e.deleted && e.produto === rec.produto && e.un === rec.dosagem_un);
        let modif = newStatus === 'APLICADO' ? -rec.dosagem_qtd : rec.dosagem_qtd; 
        if (est) { est.qtd += modif; est.updatedAt = Date.now(); }
        else if (newStatus === 'APLICADO') estoque.push({ id: generateUUID(), updatedAt: Date.now(), deleted: false, produto: rec.produto, principio: "", tipo: rec.tipo, qtd: modif, un: rec.dosagem_un, valor_unit: 0 });
    }
    salvarDados(); aplicarFiltroSafraApp();
}

function saveAndRenderApp() {
    let validRecords = agriRecords.filter(r => r && !r.deleted);
    validRecords.sort((a, b) => new Date(sanitizeDateString(a.data)||0) - new Date(sanitizeDateString(b.data)||0));
    
    const sel = document.getElementById('safraSelector'); const safraSelecionada = sel ? sel.value : "TODAS";
    const visibleRecords = safraSelecionada === "TODAS" ? validRecords : validRecords.filter(r => obterSafraGeral(r.data) === safraSelecionada);
    let html = '';
    visibleRecords.forEach(rec => {
        try {
            let statusClass = rec.status === 'APLICADO' ? 'status-aplicado' : 'status-planejado';
            let itemEstoque = estoque.find(e => e && !e.deleted && e.produto === rec.produto && e.un === rec.dosagem_un);
            let aviso = (String(rec.status).toUpperCase() === 'PLANEJADO' && (!itemEstoque || itemEstoque.qtd < rec.dosagem_qtd)) ? '<br><span class="stock-warning">⚠️ FALTA NO ESTOQUE</span>' : '';
            let custoTotal = custoAplicacao(rec);
            
            let cClass = ''; let tStr = String(rec.tipo||'').toUpperCase();
            if (tStr.includes('ADUBO') || tStr.includes('FERTILIZANTE')) cClass = 'linha-adubo';
            else if (tStr.includes('INSETICIDA')) cClass = 'linha-inseticida';
            else if (tStr.includes('FUNGICIDA')) cClass = 'linha-fungicida';
            else if (tStr.includes('HERBICIDA')) cClass = 'linha-herbicida';

            html += `<tr class="${cClass}"${estiloLinhaTalhao(rec.talhao)}>
                <td>${formatarData(rec.data)}</td>${celTalhao(rec.talhao)}<td><b style="color:var(--cor-azul-flat);">${strEscape(rec.produto)}</b>${aviso}</td>
                <td>${strEscape(rec.tipo)}</td><td>${strEscape(rec.alvo)||'-'}</td><td>${strSafe(rec.dosagem)}</td><td>${strEscape(rec.forma)||'-'}</td>
                <td style="font-family:'Rubik'; font-weight:700;">${formatarMoeda(custoTotal)}</td>
                <td><button class="${statusClass}" onclick="toggleStatusApp('${rec.id}')">${strSafe(rec.status)} 🔄</button></td>
                <td class="no-print" style="text-align:center;"><button class="btn-acao btn-editar" onclick="editAgriRecord('${rec.id}')">✏️</button><button class="btn-acao btn-excluir" onclick="deleteAgriRecord('${rec.id}')">🗑️</button></td>
            </tr>`;
        } catch(e) {}
    });
    document.getElementById('tableBodyAgri').innerHTML = html || '<tr><td colspan="10" style="text-align:center; padding:30px; color:#aaa;">Nenhuma aplicação registada</td></tr>';
    updateFilterOptionsAgri(visibleRecords);
}

function addEstoque(e) {
    e.preventDefault();
    const estRecord = { id: generateUUID(), updatedAt: Date.now(), deleted: false, produto: document.getElementById('est_produto').value.toUpperCase(), principio: document.getElementById('est_principio').value.toUpperCase(), tipo: verificarNovaOpcao('tipos', document.getElementById('est_tipo').value), qtd: parseFloat(document.getElementById('est_qtd').value), un: document.getElementById('est_un').value, valor_unit: parseFloat(document.getElementById('est_valor_unit').value) || 0, qtd_min: parseFloat(document.getElementById('est_min').value) || 0 };
    const editId = document.getElementById('editEstoqueIndex').value;
    if (!editId) {
        const existing = estoque.find(item => item && !item.deleted && item.produto === estRecord.produto && item.un === estRecord.un);
        if(existing) { { const q0 = Math.max(0, parseFloat(existing.qtd) || 0); const tot = q0 + estRecord.qtd;
            existing.valor_unit = tot > 0 ? ((q0 * (parseFloat(existing.valor_unit) || 0)) + (estRecord.qtd * estRecord.valor_unit)) / tot : estRecord.valor_unit; }
            existing.qtd = (parseFloat(existing.qtd) || 0) + estRecord.qtd; if (estRecord.qtd_min > 0) existing.qtd_min = estRecord.qtd_min; existing.principio = estRecord.principio || existing.principio; existing.updatedAt = Date.now(); } else estoque.push(estRecord);
    } else { 
        let idx = estoque.findIndex(e => e.id === editId);
        if(idx > -1) { estRecord.id = estoque[idx].id; estoque[idx] = estRecord; }
        document.getElementById('editEstoqueIndex').value = ""; 
    }
    salvarDados(); renderDatalistsAgri(); saveAndRenderEstoque(); saveAndRenderApp(); document.getElementById('form_estoque').reset(); mostrarToast("Estoque Atualizado!"); focarPrimeiroCampo('est_produto');
}

// Quantidade que as aplicações PENDENTES (planejadas, do mês atual ou atrasadas) vão consumir do produto; aplicações já realizadas não contam
function demandaPendente(rec) {
    const mesAtual = hojeLocal().substring(0, 7); let d = 0;
    agriRecords.forEach(r => { if (r && !r.deleted && String(r.status).toUpperCase() === 'PLANEJADO' && r.data && sanitizeDateString(r.data).substring(0, 7) <= mesAtual && r.produto === rec.produto && r.dosagem_un === (rec.un || rec.dosagem_un)) d += parseFloat(r.dosagem_qtd) || 0; });
    return d;
}

function saveAndRenderEstoque() {
    let validEstoque = estoque.filter(e => e && !e.deleted && e.produto);
    validEstoque.sort((a, b) => {
        const totalDe = r => { const q = parseFloat(r.qtd) || 0; return q > 0 ? q * (parseFloat(r.valor_unit) || 0) : 0; };
        let cmp = 0;
        if (estSortCol === 'qtd' || estSortCol === 'valor_unit') { cmp = (parseFloat(a[estSortCol]) || 0) - (parseFloat(b[estSortCol]) || 0); }
        else if (estSortCol === 'total') { cmp = totalDe(a) - totalDe(b); }
        else { cmp = String(a[estSortCol] || '').toUpperCase().localeCompare(String(b[estSortCol] || '').toUpperCase(), 'pt-BR'); }
        return estSortAsc ? cmp : -cmp;
    });
    let html = ''; let somaTotal = 0;
    
    validEstoque.forEach(rec => {
        try {
            const demanda = demandaPendente(rec);
            
            let corQtd = ''; let aviso = ''; let cClass = ''; let tStr = String(rec.tipo||'').toUpperCase();
            if (tStr.includes('ADUBO')) cClass = 'linha-adubo'; else if (tStr.includes('INSETICIDA')) cClass = 'linha-inseticida'; else if (tStr.includes('FUNGICIDA')) cClass = 'linha-fungicida'; else if (tStr.includes('HERBICIDA')) cClass = 'linha-herbicida';

            let qEstoque = parseFloat(rec.qtd)||0;
            if (qEstoque < demanda) { cClass = 'tr-alerta'; corQtd = 'color: #c0392b; font-weight: 700;'; aviso = `<br><span class="stock-warning">⚠️ FALTA PARA AS PENDENTES: precisa de ${demanda.toFixed(2)} ${rec.un}</span>`; }
            else if ((parseFloat(rec.qtd_min) || 0) > 0 && qEstoque < parseFloat(rec.qtd_min)) { cClass = 'tr-alerta'; corQtd = 'color: #c0392b; font-weight: 700;'; aviso = `<br><span class="stock-warning">⚠️ ABAIXO DO MÍNIMO (${parseFloat(rec.qtd_min).toFixed(2)} ${rec.un})</span>`; }

            let vTot = qEstoque > 0 ? (qEstoque * (rec.valor_unit || 0)) : 0; somaTotal += vTot;

            html += `<tr class="${cClass}">
                <td><b style="color:var(--cor-laranja-flat);">${strEscape(rec.produto)}</b>${aviso}</td><td>${strEscape(rec.principio)||'-'}</td><td>${strEscape(rec.tipo)}</td>
                <td style="${corQtd}">${qEstoque.toFixed(2)} ${strSafe(rec.un)}${(parseFloat(rec.qtd_min) || 0) > 0 ? `<br><span style="font-size:10px; color:#888;">mín. ${parseFloat(rec.qtd_min).toFixed(2)}</span>` : ''}</td><td>${formatarMoeda(rec.valor_unit)}</td><td style="font-weight:700; font-family:'Rubik'; color:var(--cor-texto);">${formatarMoeda(vTot)}</td>
                <td class="no-print" style="text-align:center;"><button class="btn-acao btn-editar" onclick="editEstoque('${rec.id}')">✏️</button><button class="btn-acao btn-excluir" onclick="deleteEstoque('${rec.id}')">🗑️</button></td>
            </tr>`;
        } catch(e) { }
    });
    document.getElementById('estoqueBody').innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding:30px; color:#aaa;">Estoque vazio</td></tr>';
    
    const thTot = document.getElementById('valor_total_estoque_header');
    if(thTot) thTot.innerHTML = formatarMoeda(somaTotal);
}

function renderAgriDashboard() {
    if (typeof Chart === 'undefined') return;
    const selS = document.getElementById('safraDashboardSelector'); const safraSel = selS ? selS.value : 'TODAS'; 
    const selT = document.getElementById('talhaoDashboardSelector'); const talhaoSel = selT ? selT.value : 'TODOS';
    
    let dS = {}, dT = {}, dTp = {}, dCS = {}, dCT = {}, dCSTal = {}, dCTcaixa = {}; let tApp = 0, tPlan = 0, count = 0;
    let validEstoque = estoque.filter(e => e && !e.deleted && e.produto);
    let patrim = validEstoque.reduce((acc, curr) => acc + (parseFloat(curr.qtd) > 0 ? (parseFloat(curr.qtd) * (curr.valor_unit || 0)) : 0), 0);
    document.getElementById('kpi-estoque').innerText = formatarMoeda(patrim);

    agriRecords.forEach(rec => {
        if(!rec || rec.deleted) return;
        let safra = obterSafraGeral(rec.data); let talhao = rec.talhao;
        if (safraSel !== 'TODAS' && safra !== safraSel) return; 
        if (talhaoSel !== 'TODOS' && talhao !== talhaoSel) return;
        count++;
        let itemEst = validEstoque.find(e => e.produto === rec.produto && e.un === rec.dosagem_un);
        let custo = custoAplicacao(rec);

        if (rec.status === 'APLICADO') {
            tApp += custo;
            if (!dS[safra]) dS[safra] = { L: 0, KG: 0 }; dS[safra][rec.dosagem_un] += parseFloat(rec.dosagem_qtd);
            dCS[safra] = (dCS[safra]||0) + custo;
            if (!dCSTal[safra]) dCSTal[safra] = {}; dCSTal[safra][talhao] = (dCSTal[safra][talhao]||0) + custo;
            if (!dT[talhao]) dT[talhao] = { L: 0, KG: 0 }; dT[talhao][rec.dosagem_un] += parseFloat(rec.dosagem_qtd);
            dCT[talhao] = (dCT[talhao]||0) + custo;
            if (!dTp[rec.tipo]) dTp[rec.tipo] = { L: 0, KG: 0 }; dTp[rec.tipo][rec.dosagem_un] += parseFloat(rec.dosagem_qtd);
        } else { tPlan += custo; }
    });

    // Despesas do Caixa Diário alocadas a talhões (campo Talhão, com rateio; ou Setor igual a um talhão)
    transacoes.forEach(t => {
        if (!t || t.deleted || String(t.tipo).toLowerCase() !== 'despesa') return;
        if (safraSel !== 'TODAS' && obterSafraGeral(t.data) !== safraSel) return;
        alocacaoTalhao(t).forEach(a => {
            if (talhaoSel !== 'TODOS' && a.talhao !== String(talhaoSel).toUpperCase()) return;
            dCTcaixa[a.talhao] = (dCTcaixa[a.talhao] || 0) + a.valor;
        });
    });

    document.getElementById('kpi-aplicado').innerText = formatarMoeda(tApp); document.getElementById('kpi-planejado').innerText = formatarMoeda(tPlan); document.getElementById('kpi-registros').innerText = count;

    function genChart(obj, ctxId, type, labelsKeys, ds1, ds2, color1, color2) {
        if(obj) obj.destroy(); const ctx = document.getElementById(ctxId).getContext('2d');
        return new Chart(ctx, { type: type, data: { labels: labelsKeys.length ? labelsKeys : ['Sem Dados'], datasets: [{ label: 'LITROS (L)', data: labelsKeys.map(k => ds1(k)), backgroundColor: color1, borderRadius: 2 }, { label: 'QUILOS (KG)', data: labelsKeys.map(k => ds2(k)), backgroundColor: color2, borderRadius: 2 }]}, options: { responsive: true, maintainAspectRatio: false, plugins:{ legend:{position:'bottom'} }, layout: { padding: 10 } } });
    }

    const safrasCusto = Object.keys(dCSTal).sort();
    const talhoesCusto = [...new Set(safrasCusto.flatMap(sf => Object.keys(dCSTal[sf])))].sort();
    const paleta = ['#3498db', '#62d073', '#f49f3e', '#9b59b6', '#e74c3c', '#16a085', '#34495e', '#f1c40f'];
    if (chartS_Agri) chartS_Agri.destroy();
    chartS_Agri = new Chart(document.getElementById('chartCustoSafra').getContext('2d'), {
        type: 'bar',
        data: {
            labels: safrasCusto.length ? safrasCusto.map(sf => 'Safra ' + sf) : ['Sem Dados'],
            datasets: talhoesCusto.map((tl, idx) => ({ label: tl, data: safrasCusto.map(sf => dCSTal[sf][tl] || 0), backgroundColor: paleta[idx % paleta.length], borderRadius: 2 }))
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatarMoeda(c.parsed.y)}` } } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Custo (R$)' } } }, layout: { padding: 10 } }
    });

    const talhoesK = Object.keys(dT).sort();
    chartT_Agri = genChart(chartT_Agri, 'chartTalhao', 'bar', talhoesK, k=>dT[k].L, k=>dT[k].KG, '#3498db', '#62d073');
    
    const tiposK = Object.keys(dTp).sort();
    if(chartTp_Agri) chartTp_Agri.destroy();
    chartTp_Agri = new Chart(document.getElementById('chartTipo').getContext('2d'), {
        type: 'doughnut', data: { labels: tiposK.length ? tiposK : ['Sem Dados'], datasets: [{ data: tiposK.length ? tiposK.map(k => dTp[k].L + dTp[k].KG) : [1], borderWidth: 0, hoverOffset: 4, backgroundColor: ['#f49f3e','#3498db','#62d073','#9b59b6','#e74c3c'] }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', layout: { padding: 15 } }
    });

    const costTalhoesK = [...new Set([...Object.keys(dCT), ...Object.keys(dCTcaixa)])].sort();
    if(chartCT_Agri) chartCT_Agri.destroy();
    chartCT_Agri = new Chart(document.getElementById('chartCustoTalhao').getContext('2d'), {
        type: 'bar',
        data: {
            labels: costTalhoesK.length ? costTalhoesK : ['Sem Dados'],
            datasets: [
                { label: 'APLICAÇÕES (ESTOQUE)', data: costTalhoesK.map(k => dCT[k] || 0), backgroundColor: '#f49f3e', borderRadius: 2 },
                { label: 'CAIXA DIÁRIO (SETOR)', data: costTalhoesK.map(k => dCTcaixa[k] || 0), backgroundColor: '#9b59b6', borderRadius: 2 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatarMoeda(c.parsed.y)}` } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Custo (R$)' } } }, layout: { padding: 10 } }
    });
}

function editAgriRecord(id) {
    const r = agriRecords.find(x => x.id === id); if(!r || r.deleted) return;
    const sVal = (idx, v) => { const e=document.getElementById(idx); if(e) e.value = v; };
    sVal('dataApp', sanitizeDateString(r.data)); sVal('talhao', r.talhao); sVal('produto', r.produto); sVal('tipo', r.tipo); sVal('alvo', r.alvo === '-' ? '' : r.alvo); sVal('dosagem_qtd', r.dosagem_qtd); sVal('dosagem_un', r.dosagem_un); sVal('forma', r.forma); sVal('status', r.status); sVal('editAgriIndex', id);
}
function deleteAgriRecord(id) { 
    if(confirm("EXCLUIR APLICAÇÃO?")) { 
        let r = agriRecords.find(x => x.id === id);
        if(r) {
            if (r.status === 'APLICADO' && sanitizeDateString(r.data) <= hojeLocal()) {
                let est = estoque.find(e => e && !e.deleted && e.produto === r.produto && e.un === r.dosagem_un);
                if(est) { est.qtd += r.dosagem_qtd; est.updatedAt = Date.now(); } 
            }
            r.deleted = true; r.updatedAt = Date.now(); salvarDados(); aplicarFiltroSafraApp(); 
        }
    } 
}
function editEstoque(id) { 
    let r = estoque.find(e => e.id === id); if(!r || r.deleted) return;
    const sVal = (idx, v) => { const e=document.getElementById(idx); if(e) e.value = v; };
    sVal('est_produto', r.produto); sVal('est_principio', r.principio || ''); sVal('est_tipo', r.tipo); sVal('est_qtd', r.qtd); sVal('est_un', r.un); sVal('est_valor_unit', r.valor_unit || 0); sVal('est_min', r.qtd_min || ''); sVal('editEstoqueIndex', id); 
}
function deleteEstoque(id) { 
    if(confirm("EXCLUIR ITEM DO ESTOQUE?")) { 
        let e = estoque.find(x=>x.id===id); 
        if(e) { e.deleted = true; e.updatedAt = Date.now(); salvarDados(); renderDatalistsAgri(); aplicarFiltroSafraApp(); } 
    } 
}

function updateFilterOptionsAgri(visibleRecords) {
    // CORREÇÃO CRÍTICA 2: Ocultado o filtro de DATA da lista de iteração do HTML para não quebrar a caixa de input de Data
    const filters = [ { id: 'f_agri_talhao', k: 'talhao' }, { id: 'f_agri_produto', k: 'produto' }, { id: 'f_agri_tipo', k: 'tipo' }, { id: 'f_agri_alvo', k: 'alvo' }, { id: 'f_agri_forma', k: 'forma' }, { id: 'f_agri_status', k: 'status' } ];
    filters.forEach(f => { 
        const sel = document.getElementById(f.id); 
        if(!sel) return; 
        const val = sel.value; 
        sel.innerHTML = '<option value="">TODOS</option>'; 
        [...new Set(visibleRecords.map(r => f.fmt ? f.fmt(r[f.k]) : (r[f.k] || '-')))].sort().forEach(v => { 
            if(v) sel.innerHTML += `<option value="${strEscape(v)}">${strEscape(v)}</option>`; 
        }); 
        sel.value = val; 
    });
}

function limparFiltrosAgri() { 
    ['f_agri_data','f_agri_talhao','f_agri_produto','f_agri_tipo','f_agri_alvo','f_agri_forma','f_agri_status'].forEach(id => { 
        const el=document.getElementById(id); 
        if(el) el.value = ""; 
    }); 
    filterAgriTable(); 
}

function filterAgriTable() {
    const ids = ['f_agri_data','f_agri_talhao','f_agri_produto','f_agri_tipo','f_agri_alvo','','f_agri_forma','','f_agri_status'];
    // Força tudo para maiúscula durante a leitura do filtro (evita falsos negativos do CSS)
    const fs = ids.map(id => { const el = document.getElementById(id); return el ? el.value.toUpperCase() : ""; });
    
    // CORREÇÃO CRÍTICA 3: Formata a data de pesquisa (AAAA-MM-DD) para combinar com a tabela da tela (DD/MM/AAAA)
    const dateFilter = fs[0] ? formatarData(fs[0]) : "";

    const rows = document.getElementById('tableBodyAgri').getElementsByTagName('tr');
    for (let i=0; i<rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td'); 
        
        // Proteção anti-crash: Ignora a linha quando ela disser "Nenhuma aplicação registrada"
        if (cells.length < 9) continue; 
        
        const pTxt = cells[2].innerText.split('⚠️')[0].trim().toUpperCase();
        const match = [ 
            dateFilter==="" || cells[0].innerText.trim()===dateFilter, 
            fs[1]===""||cells[1].innerText.trim().toUpperCase()===fs[1], 
            fs[2]===""||pTxt===fs[2], 
            fs[3]===""||cells[3].innerText.trim().toUpperCase()===fs[3], 
            fs[4]===""||cells[4].innerText.trim().toUpperCase()===fs[4], 
            true, 
            fs[6]===""||cells[6].innerText.trim().toUpperCase()===fs[6], 
            true, 
            fs[8]===""||cells[8].innerText.replace('🔄','').trim().toUpperCase()===fs[8] 
        ];
        rows[i].style.display = match.every(Boolean) ? '' : 'none';
    }
}

function sortAgriTable(n) {
    let ord = [...agriRecords.filter(r => !r.deleted)];
    let key = ['data','talhao','produto','tipo','alvo','dosagem','forma','custo','status'][n];
    ord.sort((a,b) => {
        let vA = a[key] || ''; let vB = b[key] || '';
        if(n===7) { // custo numérico
           let ae = estoque.find(e=>!e.deleted&&e.produto===a.produto&&e.un===a.dosagem_un);
           let be = estoque.find(e=>!e.deleted&&e.produto===b.produto&&e.un===b.dosagem_un);
           vA = custoAplicacao(a);
           vB = custoAplicacao(b);
        }
        if(n===0) { vA = new Date(sanitizeDateString(vA)).getTime()||0; vB = new Date(sanitizeDateString(vB)).getTime()||0; }
        if(vA < vB) return ordemAscendente ? -1 : 1;
        if(vA > vB) return ordemAscendente ? 1 : -1;
        return 0;
    });
    ordemAscendente = !ordemAscendente;
    
    const selS = document.getElementById('safraSelector'); const safraSelecionada = selS ? selS.value : "TODAS";
    const visible = safraSelecionada === "TODAS" ? ord : ord.filter(r => obterSafraGeral(r.data) === safraSelecionada);
    let html = '';
    visible.forEach(rec => {
        let statusClass = rec.status === 'APLICADO' ? 'status-aplicado' : 'status-planejado';
        let itemEstoque = estoque.find(e => e && !e.deleted && e.produto === rec.produto && e.un === rec.dosagem_un);
        let aviso = (String(rec.status).toUpperCase() === 'PLANEJADO' && (!itemEstoque || itemEstoque.qtd < rec.dosagem_qtd)) ? '<br><span class="stock-warning">⚠️ FALTA NO ESTOQUE</span>' : '';
        let custoTotal = custoAplicacao(rec);
        let cClass = ''; let tStr = String(rec.tipo||'').toUpperCase();
        if (tStr.includes('ADUBO') || tStr.includes('FERTILIZANTE')) cClass = 'linha-adubo'; else if (tStr.includes('INSETICIDA')) cClass = 'linha-inseticida'; else if (tStr.includes('FUNGICIDA')) cClass = 'linha-fungicida'; else if (tStr.includes('HERBICIDA')) cClass = 'linha-herbicida';

        html += `<tr class="${cClass}"${estiloLinhaTalhao(rec.talhao)}>
            <td>${formatarData(rec.data)}</td>${celTalhao(rec.talhao)}<td><b style="color:var(--cor-azul-flat);">${strEscape(rec.produto)}</b>${aviso}</td>
            <td>${strEscape(rec.tipo)}</td><td>${strEscape(rec.alvo)||'-'}</td><td>${strSafe(rec.dosagem)}</td><td>${strEscape(rec.forma)||'-'}</td>
            <td style="font-family:'Rubik'; font-weight:700;">${formatarMoeda(custoTotal)}</td>
            <td><button class="${statusClass}" onclick="toggleStatusApp('${rec.id}')">${strSafe(rec.status)} 🔄</button></td>
            <td class="no-print" style="text-align:center;"><button class="btn-acao btn-editar" onclick="editAgriRecord('${rec.id}')">✏️</button><button class="btn-acao btn-excluir" onclick="deleteAgriRecord('${rec.id}')">🗑️</button></td>
        </tr>`;
    });
    const tbody = document.getElementById('tableBodyAgri'); if(tbody) tbody.innerHTML = html;
}

/* -------------------------------------------------------------------------
   8. MÓDULO: SOLO E NUTRIÇÃO
------------------------------------------------------------------------- */
function switchSoloTab(tabId) {
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sub-menu button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('btn_' + tabId).classList.add('active');
    if (tabId === 'solo_hist') { popularDatasHistoricoSolo(); }
    if (tabId === 'solo_calc') { carregarUltimaAnaliseParaCalculo(); atualizarMetaProdutividade(); }
}

function popularSeletorSolo() {
    const talhoesSet = new Set();
    analisesSolo.forEach(a => { if(a && !a.deleted && a.talhao) talhoesSet.add(a.talhao) });
    (opcoesDin.talhoes||[]).forEach(t => talhoesSet.add(t));
    const html = Array.from(talhoesSet).sort().map(t => `<option value="${strEscape(t)}">${strEscape(t)}</option>`).join('');
    const ht = document.getElementById('hist_talhao'); if(ht) ht.innerHTML = html;
    const ct = document.getElementById('calc_talhao'); if(ct) ct.innerHTML = html;
    renderizarTabelaHistoricoSolo();
}

function calcularSomasSolo() {
    let cEl = document.getElementById('sl_ca'); let ca = cEl ? parseNS(cEl.value) : 0;
    let mEl = document.getElementById('sl_mg'); let mg = mEl ? parseNS(mEl.value) : 0;
    let kEl = document.getElementById('sl_k'); let k_mg = kEl ? parseNS(kEl.value) : 0;
    let aEl = document.getElementById('sl_al'); let al = aEl ? parseNS(aEl.value) : 0;
    let hEl = document.getElementById('sl_hal'); let hal = hEl ? parseNS(hEl.value) : 0;
    let nEl = document.getElementById('sl_na'); let na = nEl ? parseNS(nEl.value) : 0;

    let k_cmol = k_mg / 391; let na_cmol = na / 230; 
    let sb = ca + mg + k_cmol + na_cmol; let t_min = sb + al; let t_max = sb + hal;
    let v = t_max > 0 ? (sb / t_max) * 100 : 0; let m = t_min > 0 ? (al / t_min) * 100 : 0;

    const sValT = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
    sValT('sl_sb', sb > 0 ? sb.toFixed(2) : 'ns'); sValT('sl_t_min', t_min > 0 ? t_min.toFixed(2) : 'ns'); sValT('sl_t_max', t_max > 0 ? t_max.toFixed(2) : 'ns');
    sValT('sl_v', t_max > 0 ? v.toFixed(0) : 'ns'); sValT('sl_m', t_min > 0 ? m.toFixed(0) : 'ns');
    aplicarCoresNiveis();
}

function aplicarCoresNiveis() {
    const argEl = document.getElementById('sl_argila'); const argila = argEl ? parseNS(argEl.value) : 0;
    const refs = { 'sl_ph_h2o': { min: 5.5, max: 6.5 }, 'sl_ph_cacl2': { min: 4.9, max: 5.9 }, 'sl_k': { min: 80, max: 9999 }, 'sl_s': { min: 10, max: 9999 }, 'sl_ca': { min: 2.4, max: 4.0 }, 'sl_mg': { min: 0.9, max: 1.5 }, 'sl_al': { min: -1, max: 0.2 }, 'sl_hal': { min: -1, max: 2.0 }, 'sl_mo': { min: 2.1, max: 4.5 } };
    
    let p_min = 12.1, p_max = 18.0; 
    if (argila >= 600) { p_min = 8.1; p_max = 12.0; } else if (argila > 0 && argila <= 150) { p_min = 30.1; p_max = 45.0; } else if (argila > 150 && argila < 350) { p_min = 20.1; p_max = 30.0; } 
    refs['sl_p_meh'] = { min: p_min, max: p_max };

    let extBEl = document.getElementById('ext_b'); let ext_b = extBEl ? extBEl.value : "1";
    let extCuEl = document.getElementById('ext_cu'); let ext_cu = extCuEl ? extCuEl.value : "1";
    let extMnEl = document.getElementById('ext_mn'); let ext_mn = extMnEl ? extMnEl.value : "1";
    let extZnEl = document.getElementById('ext_zn'); let ext_zn = extZnEl ? extZnEl.value : "1";

    refs['sl_b'] = ext_b === "1" ? { min: 0.3, max: 0.7 } : { min: 0.2, max: 0.4 };
    refs['sl_cu'] = ext_cu === "1" ? { min: 0.5, max: 1.0 } : { min: 0.3, max: 0.6 };
    refs['sl_mn'] = ext_mn === "1" ? { min: 5.0, max: 10.0 } : { min: 1.0, max: 2.5 };
    refs['sl_zn'] = ext_zn === "1" ? { min: 2.0, max: 4.0 } : { min: 0.7, max: 1.1 };

    Object.keys(refs).forEach(id => {
        let el = document.getElementById(id); if(!el) return;
        el.classList.remove('val-baixo', 'val-ideal', 'val-alto'); let valStr = el.value.trim().toLowerCase();
        if(valStr && valStr !== 'ns') {
            let v = parseFloat(valStr.replace(',','.'));
            if(!isNaN(v)) { if (v < refs[id].min) el.classList.add('val-baixo'); else if (v > refs[id].max) el.classList.add('val-alto'); else el.classList.add('val-ideal'); }
        }
    });
}

function salvarAnaliseSolo(e) {
    e.preventDefault();
    const dEl = document.getElementById('sl_data'); const data = dEl ? dEl.value : '';
    const tEl = document.getElementById('sl_talhao'); const talhao = tEl ? tEl.value.trim().toUpperCase() : '';
    const pEl = document.getElementById('sl_prof'); const prof = pEl ? pEl.value : '';
    const idEl = document.getElementById('sl_id'); const idEdicao = idEl ? idEl.value : '';
    
    if(!data || !talhao) { alert("Preencha a Data e o Talhão!"); return; }
    calcularSomasSolo();

    const sVal = id => { const el = document.getElementById(id); return el ? el.value : ''; };

    const nova = {
        id: idEdicao ? idEdicao : generateUUID(), updatedAt: Date.now(), deleted: false, data: sanitizeDateString(data), talhao: talhao, prof: prof,
        ph_h2o: sVal('sl_ph_h2o'), ph_cacl2: sVal('sl_ph_cacl2'), ph_kcl: sVal('sl_ph_kcl'), ce: sVal('sl_ce'), 
        al: sVal('sl_al'), hal: sVal('sl_hal'), sb: sVal('sl_sb'), t_min: sVal('sl_t_min'), t_max: sVal('sl_t_max'), v: sVal('sl_v'), m: sVal('sl_m'),
        p_meh: sVal('sl_p_meh'), prem: sVal('sl_prem'), pres: sVal('sl_pres'), ptotal: sVal('sl_ptotal'), na: sVal('sl_na'), k: sVal('sl_k'), s: sVal('sl_s'),
        ca: sVal('sl_ca'), mg: sVal('sl_mg'), mo: sVal('sl_mo'), co: sVal('sl_co'),
        b: sVal('sl_b'), ext_b: sVal('ext_b') || '1',
        cu: sVal('sl_cu'), ext_cu: sVal('ext_cu') || '1',
        fe: sVal('sl_fe'), 
        mn: sVal('sl_mn'), ext_mn: sVal('ext_mn') || '1',
        zn: sVal('sl_zn'), ext_zn: sVal('ext_zn') || '1',
        areia_g: sVal('sl_areia_g'), areia_f: sVal('sl_areia_f'), areia_t: sVal('sl_areia_t'), silte: sVal('sl_silte'), argila: sVal('sl_argila')
    };

    if (idEdicao) { let idx = analisesSolo.findIndex(a => a && a.id === idEdicao); if(idx > -1) analisesSolo[idx] = nova; } else { analisesSolo.push(nova); }
    salvarDados(); popularSeletorSolo(); const fs = document.getElementById('formSolo'); if(fs) fs.reset(); if(idEl) idEl.value = ''; 
    document.querySelectorAll('.val-baixo, .val-ideal, .val-alto').forEach(el => el.classList.remove('val-baixo', 'val-ideal', 'val-alto')); mostrarToast("Análise Salva!");
    focarPrimeiroCampo('sl_data');
}

function renderizarTabelaHistoricoSolo() {
    let html = ''; let lista = [...analisesSolo].filter(a => a && !a.deleted && a.data).sort((a, b) => new Date(sanitizeDateString(b.data)) - new Date(sanitizeDateString(a.data)));
    lista.forEach(an => { html += `<tr${estiloLinhaTalhao(an.talhao)}><td>${formatarData(an.data)}</td>${celTalhao(an.talhao)}<td>${an.prof}</td><td>${an.ph_h2o}</td><td>${an.p_meh}</td><td>${an.k}</td><td>${an.v}%</td><td>${an.mo}</td><td style="text-align:center;"><button class="btn-acao btn-editar" onclick="editarAnaliseSolo('${an.id}')">✏️</button> <button class="btn-acao btn-excluir" onclick="excluirAnaliseSolo('${an.id}')">🗑️</button></td></tr>`; });
    const tbody = document.getElementById('tbody_historico_analises');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="9" style="text-align:center; padding:30px; color:#aaa;">Sem análises registadas</td></tr>';
}

function excluirAnaliseSolo(id) {
    if(confirm("Deseja realmente apagar esta análise?")) {
        let an = analisesSolo.find(a => a && a.id === id);
        if(an) { an.deleted = true; an.updatedAt = Date.now(); salvarDados(); popularSeletorSolo(); mostrarToast("Análise Removida!"); }
    }
}

function editarAnaliseSolo(id) {
    let an = analisesSolo.find(a => a && a.id === id); if(!an || an.deleted) return;
    const sValT = (idx, val) => { const el = document.getElementById(idx); if(el) el.value = val; };
    
    sValT('sl_id', an.id); sValT('sl_data', sanitizeDateString(an.data)); sValT('sl_talhao', an.talhao); sValT('sl_prof', an.prof);
    
    const campos = ['ph_h2o', 'ph_cacl2', 'ph_kcl', 'ce', 'al', 'hal', 'sb', 't_min', 't_max', 'v', 'm', 'p_meh', 'prem', 'pres', 'ptotal', 'na', 'k', 's', 'ca', 'mg', 'mo', 'co', 'b', 'cu', 'fe', 'mn', 'zn', 'areia_g', 'areia_f', 'areia_t', 'silte', 'argila'];
    campos.forEach(c => { sValT('sl_' + c, an[c] !== undefined ? an[c] : ''); });
    
    if(an.ext_b) sValT('ext_b', an.ext_b); if(an.ext_cu) sValT('ext_cu', an.ext_cu); if(an.ext_mn) sValT('ext_mn', an.ext_mn); if(an.ext_zn) sValT('ext_zn', an.ext_zn);

    calcularSomasSolo(); switchSoloTab('solo_reg'); mostrarToast("Modo de Edição Ativo");
}

function popularDatasHistoricoSolo() {
    renderizarTabelaHistoricoSolo();
    const htEl = document.getElementById('hist_talhao'); const talhao = htEl ? htEl.value : '';
    const selectData = document.getElementById('hist_data');
    let datasUnicas = [...new Set(analisesSolo.filter(a => a && !a.deleted && a.talhao === talhao).map(a => sanitizeDateString(a.data)))].sort((a,b) => new Date(b) - new Date(a));
    if (datasUnicas.length > 0 && selectData) { selectData.innerHTML = datasUnicas.map(d => `<option value="${strEscape(d)}">${formatarData(d)}</option>`).join(''); renderizarGraficoDataEspecifica(); } 
    else if (selectData) { selectData.innerHTML = '<option value="">Sem Análises</option>'; if(chartSoloPrincipal) chartSoloPrincipal.destroy(); }
}

function renderizarGraficoDataEspecifica() {
    if (typeof Chart === 'undefined') return;
    const htEl = document.getElementById('hist_talhao'); const talhao = htEl ? htEl.value : ''; 
    const hdEl = document.getElementById('hist_data'); const dataSel = hdEl ? hdEl.value : '';
    if(!dataSel) return;
    let analisesDoDia = analisesSolo.filter(a => a && !a.deleted && a.talhao === talhao && sanitizeDateString(a.data) === dataSel);
    let an020 = analisesDoDia.find(a => a.prof === '0-20'); let an2040 = analisesDoDia.find(a => a.prof === '20-40'); let anFoliar = analisesDoDia.find(a => a.prof === 'Foliar');
    const labels = ['P (mg)', 'K (mg)', 'Ca (cmol)', 'Mg (cmol)', 'SB', 'T (CTC)', 'V (%)'];
    
    let data020 = an020 ? [parseNS(an020.p_meh), parseNS(an020.k), parseNS(an020.ca), parseNS(an020.mg), parseNS(an020.sb), parseNS(an020.t_max), parseNS(an020.v)] : [];
    let data2040 = an2040 ? [parseNS(an2040.p_meh), parseNS(an2040.k), parseNS(an2040.ca), parseNS(an2040.mg), parseNS(an2040.sb), parseNS(an2040.t_max), parseNS(an2040.v)] : [];
    let dataFoliar = anFoliar ? [parseNS(anFoliar.p_meh), parseNS(anFoliar.k), parseNS(anFoliar.ca), parseNS(anFoliar.mg), parseNS(anFoliar.sb), parseNS(anFoliar.t_max), parseNS(anFoliar.v)] : [];

    let datasets = [];
    if(an020) datasets.push({ label: '0-20 cm', data: data020, backgroundColor: '#62d073', borderRadius: 4 });
    if(an2040) datasets.push({ label: '20-40 cm', data: data2040, backgroundColor: '#9b59b6', borderRadius: 4 });
    if(anFoliar) datasets.push({ label: 'Foliar', data: dataFoliar, backgroundColor: '#f49f3e', borderRadius: 4 });

    if (chartSoloPrincipal) chartSoloPrincipal.destroy();
    const ctx = document.getElementById('chartSoloPrincipal');
    if(ctx) chartSoloPrincipal = new Chart(ctx.getContext('2d'), { type: 'bar', data: { labels: labels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false } });
}

function abrirGraficoDetalhado() {
    const htEl = document.getElementById('hist_talhao'); const talhao = htEl ? htEl.value : ''; 
    const hdEl = document.getElementById('hist_data'); const dataSel = hdEl ? hdEl.value : '';
    if(!dataSel) { alert("Selecione uma data com análises."); return; }
    let analisesDoDia = analisesSolo.filter(a => a && !a.deleted && a.talhao === talhao && sanitizeDateString(a.data) === dataSel);
    let an020 = analisesDoDia.find(a => a.prof === '0-20'); let an2040 = analisesDoDia.find(a => a.prof === '20-40'); let anFoliar = analisesDoDia.find(a => a.prof === 'Foliar');
    
    const labels = ['Boro (B)', 'Cobre (Cu)', 'Ferro (Fe)', 'Manganês (Mn)', 'Zinco (Zn)', 'M.O.', 'Argila (x10)'];
    let d020 = an020 ? [parseNS(an020.b), parseNS(an020.cu), parseNS(an020.fe), parseNS(an020.mn), parseNS(an020.zn), parseNS(an020.mo), parseNS(an020.argila)/10] : [];
    let d2040 = an2040 ? [parseNS(an2040.b), parseNS(an2040.cu), parseNS(an2040.fe), parseNS(an2040.mn), parseNS(an2040.zn), parseNS(an2040.mo), parseNS(an2040.argila)/10] : [];
    let dFoliar = anFoliar ? [parseNS(anFoliar.p_meh), parseNS(anFoliar.k), parseNS(anFoliar.ca), parseNS(anFoliar.mg), parseNS(anFoliar.sb), parseNS(anFoliar.t_max), parseNS(anFoliar.v)] : [];
    let datasets = [];
    if(an020) datasets.push({ label: '0-20 cm', data: d020, backgroundColor: '#62d073', borderRadius: 4 });
    if(an2040) datasets.push({ label: '20-40 cm', data: d2040, backgroundColor: '#9b59b6', borderRadius: 4 });
    if(anFoliar) datasets.push({ label: 'Foliar', data: dFoliar, backgroundColor: '#f49f3e', borderRadius: 4 });

    const m = document.getElementById('modal-grafico-detalhado'); if(m) m.style.display = 'flex';
    if (chartSoloMicros) chartSoloMicros.destroy();
    const ctx = document.getElementById('chartSoloMicros');
    if(ctx) chartSoloMicros = new Chart(ctx.getContext('2d'), { type: 'bar', data: { labels: labels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false } });
}

// --- CALCULADORA INTELIGENTE ---
let analiseCarregadaParaCalculo = null; 

function carregarUltimaAnaliseParaCalculo() {
    const cEl = document.getElementById('calc_talhao'); const talhao = cEl ? cEl.value : '';
    let filtradas = analisesSolo.filter(a => a && !a.deleted && a.talhao === talhao).sort((a, b) => new Date(sanitizeDateString(b.data)||0) - new Date(sanitizeDateString(a.data)||0));

    let ultima020 = filtradas.find(a => a.prof === '0-20'); let ultima2040 = filtradas.find(a => a.prof === '20-40');
    analiseCarregadaParaCalculo = ultima020;
    const infoT = infoTalhao(talhao);
    if (infoT) { const setv = (i, v) => { const el = document.getElementById(i); if (el) el.value = v; }; if (infoT.area) setv('calc_area', infoT.area); if (infoT.plantas) setv('calc_plantas', infoT.plantas); if (infoT.cultura) setv('calc_cultura', infoT.cultura); } 

    const ld020 = document.getElementById('lbl_data_020'); if(ld020) ld020.innerText = ultima020 ? formatarData(ultima020.data) : "SEM DADOS"; 
    const ld2040 = document.getElementById('lbl_data_2040'); if(ld2040) ld2040.innerText = ultima2040 ? formatarData(ultima2040.data) : "SEM DADOS";

    const sValT = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    sValT('calc_p', ultima020 ? ultima020.p_meh : 'ns'); sValT('calc_k', ultima020 ? ultima020.k : 'ns'); sValT('calc_v020', ultima020 ? ultima020.v : 'ns'); sValT('calc_ctc', ultima020 ? ultima020.t_max : 'ns'); sValT('calc_mo', ultima020 ? ultima020.mo : 'ns'); sValT('calc_prem', ultima020 ? ultima020.prem : 'ns');
    sValT('calc_ca2040', ultima2040 ? ultima2040.ca : 'ns'); sValT('calc_al2040', ultima2040 ? ultima2040.al : 'ns'); sValT('calc_m2040', ultima2040 ? ultima2040.m : 'ns'); sValT('calc_argila', ultima2040 ? ultima2040.argila : (ultima020 ? ultima020.argila : 'ns'));
}

function atualizarMetaProdutividade() {} // Desligado

function alternarFaseCultura() {
    const cf = document.getElementById('calc_fase'); const fase = cf ? cf.value : '';
    const dProd = document.getElementById('div_prod_esperada'); const dPlant = document.getElementById('div_doses_plantio');
    if(fase === 'implantacao') { if(dProd) dProd.style.display = 'none'; if(dPlant) dPlant.style.display = 'grid'; } 
    else { if(dProd) dProd.style.display = 'grid'; if(dPlant) dPlant.style.display = 'none'; }
}

function calcularRecomendacao() {
    const cEl = document.getElementById('calc_cultura'); const cultura = cEl ? cEl.value : ''; 
    const fEl = document.getElementById('calc_fase'); const fase = fEl ? fEl.value : '';
    const aEl = document.getElementById('calc_area'); const area = aEl ? parseFloat(aEl.value) || 1 : 1; 
    const plEl = document.getElementById('calc_plantas'); const estande = plEl ? parseFloat(plEl.value) || 3000 : 3000; 
    const prEl = document.getElementById('calc_prnt'); const prnt = prEl ? parseFloat(prEl.value) || 90 : 90;
    
    const gV = id => { const e=document.getElementById(id); return e?e.value:''; };
    const v_020 = parseNS(gV('calc_v020')); const ctc_020 = parseNS(gV('calc_ctc')); const p_020 = parseNS(gV('calc_p')); const k_020 = parseNS(gV('calc_k')); const mo_020 = parseNS(gV('calc_mo')); const prem_020 = parseNS(gV('calc_prem'));
    const ca_2040_val = gV('calc_ca2040'); const al_2040_val = gV('calc_al2040'); const m_2040_val = gV('calc_m2040'); const argila_pct = parseNS(gV('calc_argila')) / 10; 

    let exp = "<strong style='font-family:Rubik;'>PARECER AGRONÔMICO (CFSEMG):</strong><br><br>";

    const v_alvo = cultura === 'maracuja' ? 80 : 60; let calcario_ha = 0;
    if (v_020 > 0 && v_020 < v_alvo) { 
        calcario_ha = ((ctc_020 * (v_alvo - v_020)) / prnt); 
        exp += `✅ <strong>Calagem:</strong> ${calcario_ha.toFixed(1)} t/ha. O V% atual (${v_020}%) está abaixo do alvo (${v_alvo}%). Total área: ${(calcario_ha * area).toFixed(1)} t.<br>`; 
    } else { exp += `☑️ <strong>Calagem:</strong> Não recomendada. V% adequado.<br>`; }
    
    let gesso_ha = 0;
    if (ca_2040_val === 'ns' || ca_2040_val === '' || al_2040_val === 'ns' || al_2040_val === '') {
        exp += `<span style="color:var(--cor-vermelho-flat);">⚠️ <strong>Gessagem:</strong> Sem análise 20-40 cm: gessagem não avaliada.</span><br>`;
    } else {
        let ca_2040 = parseNS(ca_2040_val); let al_2040 = parseNS(al_2040_val); let m_2040 = parseNS(m_2040_val);
        if (ca_2040 < 0.5 || al_2040 > 0.5 || m_2040 > 20) { 
            let K13 = ctc_020 * (60 - v_020) / 100;
            gesso_ha = (K13 * 0.3) * 1000;
            if(gesso_ha < 0) gesso_ha = 0;
            exp += `✅ <strong>Gessagem:</strong> ${gesso_ha.toFixed(0)} kg/ha devido a barreira química (20-40cm). Total: ${(gesso_ha * area).toFixed(0)} kg.<br>`; 
        } else { exp += `☑️ <strong>Gessagem:</strong> Não recomendada (Subsuperfície adequada).<br>`; }
    }

    let f_p = parseFloat(gV('calc_fp')) || 1; let f_k = parseFloat(gV('calc_fk')) || 1;

    if (fase === 'producao') {
        const prod = parseFloat(gV('calc_prod')) || 0;
        if (cultura === 'conilon') {
            const mo_adj = mo_020 <= 10 ? mo_020 : 10;
            reqGeralCalc.n = Math.max(0, 226.417 + (2.465 * prod) - (10.975 * mo_adj)) * 0.9;
            reqGeralCalc.p = Math.max(0, (189 + (0.537 * prod) - (8.26 * p_020) - (2.1 * prem_020)) - (mo_adj * 2)) * f_p;
            reqGeralCalc.k = Math.max(0, (236.47 + (2.381 * prod) - (1.21 * k_020)) - (mo_adj * 3)) * f_k;
        } else if (cultura === 'maracuja') {
            reqGeralCalc.n = prod < 20 ? 100 : (prod < 40 ? 140 : 160);
            reqGeralCalc.p = p_020 < 10 ? 120 : (p_020 < 20 ? 80 : (p_020 < 50 ? 50 : 0));
            reqGeralCalc.k = k_020 < 60 ? 360 : (k_020 < 100 ? 300 : (k_020 < 150 ? 240 : (k_020 < 200 ? 120 : 0)));
        }
        exp += `✅ <strong>Nutrição NPK:</strong> Exportação projetada para ${prod}.`;
    } else {
        const d_n = parseFloat(gV('calc_dose_n')) || 0; const d_p = parseFloat(gV('calc_dose_p')) || 0; const d_k = parseFloat(gV('calc_dose_k')) || 0;
        reqGeralCalc.n = (d_n * estande) / 1000; reqGeralCalc.p = (d_p * estande) / 1000; reqGeralCalc.k = (d_k * estande) / 1000;
        exp += `✅ <strong>Nutrição NPK (Plantio):</strong> Dose base digitada pelo agrónomo.`;
    }

    let rec_zn = 0, rec_b = 0, rec_cu = 0, rec_mn = 0;
    if (analiseCarregadaParaCalculo) {
        let a = analiseCarregadaParaCalculo;
        let vZn = parseNS(a.zn), vB = parseNS(a.b), vCu = parseNS(a.cu), vMn = parseNS(a.mn);
        
        if (a.ext_zn === "1" || !a.ext_zn) { if (vZn > 0) { if (vZn < 2) rec_zn = 4; else if (vZn >= 2 && vZn < 4) rec_zn = 4; else if (vZn >= 4 && vZn < 6) rec_zn = 2; else rec_zn = 0; }
        } else { if (vZn > 0) { if (vZn < 0.7) rec_zn = 6; else if (vZn >= 0.7 && vZn < 1.1) rec_zn = 4; else if (vZn >= 1.1 && vZn < 1.5) rec_zn = 2; else rec_zn = 0; } }
        
        if (a.ext_b === "1" || !a.ext_b) { if (vB > 0) { if (vB < 0.3) rec_b = 3; else if (vB >= 0.3 && vB < 0.7) rec_b = 2; else if (vB >= 0.7 && vB < 1.0) rec_b = 1; else rec_b = 0; }
        } else { if (vB > 0) { if (vB < 0.2) rec_b = 3; else if (vB >= 0.2 && vB < 0.4) rec_b = 2; else if (vB >= 0.4 && vB < 0.6) rec_b = 1; else rec_b = 0; } }

        if (a.ext_cu === "1" || !a.ext_cu) { if (vCu > 0) { if (vCu < 0.5) rec_cu = 3; else if (vCu >= 0.5 && vCu < 1.0) rec_cu = 2; else if (vCu >= 1.0 && vCu < 1.5) rec_cu = 1; else rec_cu = 0; }
        } else { if (vCu > 0) { if (vCu < 0.3) rec_cu = 3; else if (vCu >= 0.3 && vCu < 0.7) rec_cu = 2; else if (vCu >= 0.7 && vCu < 1.0) rec_cu = 1; else rec_cu = 0; } }

        if (a.ext_mn === "1" || !a.ext_mn) { if (vMn > 0) { if (vMn < 5) rec_mn = 15; else if (vMn >= 5 && vMn < 10) rec_mn = 10; else if (vMn >= 10 && vMn < 15) rec_mn = 5; else rec_mn = 0; }
        } else { if (vMn > 0) { if (vMn < 1.0) rec_mn = 15; else if (vMn >= 1.0 && vMn < 2.5) rec_mn = 10; else if (vMn >= 2.5 && vMn < 5.0) rec_mn = 5; else rec_mn = 0; } }
        exp += `<br>✅ <strong>Micronutrientes:</strong> As recomendações basearam-se no extrator da análise.`;
    }

    reqGeralCalc.zn = rec_zn; reqGeralCalc.b = rec_b; reqGeralCalc.cu = rec_cu; reqGeralCalc.mn = rec_mn;

    const sTXT = (id, t) => { const el = document.getElementById(id); if(el) el.innerText = t; };
    sTXT('res_n', reqGeralCalc.n.toFixed(0)); sTXT('res_p', reqGeralCalc.p.toFixed(0)); sTXT('res_k', reqGeralCalc.k.toFixed(0));
    sTXT('lbl_prnt', prnt); sTXT('res_calcario', calcario_ha.toFixed(1)); sTXT('res_gesso', gesso_ha.toFixed(0)); 
    sTXT('res_zn', rec_zn.toFixed(1)); sTXT('res_b', rec_b.toFixed(1)); sTXT('res_cu', rec_cu.toFixed(1)); sTXT('res_mn', rec_mn.toFixed(1));
    
    const le = document.getElementById('laudo_explicacao'); if(le) le.innerHTML = exp;

    gerarCronogramaAdub(fase, area, estande); mostrarToast("Cálculo Gerado!");
}

function gerarCronogramaAdub(fase, area, estande) {
    const tabela = document.getElementById('tbody_cronograma_calc');
    const matriz = {
        'Ureia': { c: 0.45, fe: 0.70, n: "UREIA" }, 'Ureia_NBPT': { c: 0.45, fe: 0.85, n: "UREIA TRAT." }, 'Nitrato': { c: 0.33, fe: 0.95, n: "NITRATO" }, 'Sulfato': { c: 0.21, fe: 0.90, n: "SULFATO" },
        'MAP': { c: 0.52, nc: 0.11, fe: 0.95, n: "MAP" }, 'SSG': { c: 0.18, nc: 0, fe: 0.95, n: "SUPER SIMPLES" },
        'KCl': { c: 0.60, nc: 0, fe: 0.85, n: "KCL" }
    };

    const fnEl = document.getElementById('calc_fonte_n'); const selN = fnEl ? fnEl.value : 'Ureia';
    const fpEl = document.getElementById('calc_fonte_p'); const selP = fpEl ? fpEl.value : 'MAP';
    const fkEl = document.getElementById('calc_fonte_k'); const selK = fkEl ? fkEl.value : 'KCl';
    
    const ftN = matriz[selN]; const ftP = matriz[selP]; const ftK = matriz[selK];

    const sTXT = (id, t) => { const el = document.getElementById(id); if(el) el.innerText = t; };
    sTXT('th_fonte_n', ftN.n); sTXT('th_fonte_p', ftP.n); sTXT('th_fonte_k', ftK.n);

    let vol_p_ha = reqGeralCalc.p / (ftP.c * ftP.fe); 
    let n_fornecido_p_ha = vol_p_ha * ftP.nc; 
    let demanda_n_liquida_ha = Math.max(0, reqGeralCalc.n - n_fornecido_p_ha);
    let vol_n_ha = demanda_n_liquida_ha / (ftN.c * ftN.fe); 
    let vol_k_ha = reqGeralCalc.k / (ftK.c * ftK.fe); 

    let bodyHTML = "";

    if (fase === 'implantacao') {
        let u_tot = vol_n_ha * area; let u_pl = (vol_n_ha * 1000) / estande; let m_tot = vol_p_ha * area; let m_pl = (vol_p_ha * 1000) / estande; let k_tot = vol_k_ha * area; let k_pl = (vol_k_ha * 1000) / estande;
        bodyHTML += `<tr><td style="font-weight:700; color: #555; vertical-align:middle;">PLANTIO (Cova)</td>
            <td style="text-align: center;"><b style="color:var(--cor-verde-flat); font-size:14px;">${vol_n_ha.toFixed(1)} kg/ha</b><br><span style="color:#888;">${u_tot.toFixed(1)} kg/talhão<br>${u_pl.toFixed(0)} g/cova</span></td>
            <td style="text-align: center;"><b style="color:var(--cor-laranja-flat); font-size:14px;">${vol_p_ha.toFixed(1)} kg/ha</b><br><span style="color:#888;">${m_tot.toFixed(1)} kg/talhão<br>${m_pl.toFixed(0)} g/cova</span></td>
            <td style="text-align: center;"><b style="color:var(--cor-azul-flat); font-size:14px;">${vol_k_ha.toFixed(1)} kg/ha</b><br><span style="color:#888;">${k_tot.toFixed(1)} kg/talhão<br>${k_pl.toFixed(0)} g/cova</span></td></tr>`;
        cronogramaFinal = [{ mes: "Plantio", n: u_tot, p: m_tot, k: k_tot, fn: ftN.n, fp: ftP.n, fk: ftK.n }];
    } else {
        let dist = [ { mes: "Set/Out", pct: 15 }, { mes: "Nov/Dez", pct: 35 }, { mes: "Jan/Fev", pct: 35 }, { mes: "Mar/Abr", pct: 15 } ];
        cronogramaFinal = [];
        dist.forEach(d => {
            let frac = d.pct / 100; 
            let u_ha = vol_n_ha * frac; let u_tot = u_ha * area; let u_pl = (u_ha * 1000) / estande; let m_ha = vol_p_ha * frac; let m_tot = m_ha * area; let m_pl = (m_ha * 1000) / estande; let k_ha = vol_k_ha * frac; let k_tot = k_ha * area; let k_pl = (k_ha * 1000) / estande;
            bodyHTML += `<tr><td style="font-weight:700; color: #555; vertical-align:middle;">${d.mes}</td>
                <td style="text-align: center;"><b style="color:var(--cor-verde-flat); font-size:14px;">${u_ha.toFixed(1)} kg/ha</b><br><span style="color:#888;">${u_tot.toFixed(1)} kg/talhão<br>${u_pl.toFixed(0)} g/planta</span></td>
                <td style="text-align: center;"><b style="color:var(--cor-laranja-flat); font-size:14px;">${m_ha.toFixed(1)} kg/ha</b><br><span style="color:#888;">${m_tot.toFixed(1)} kg/talhão<br>${m_pl.toFixed(0)} g/planta</span></td>
                <td style="text-align: center;"><b style="color:var(--cor-azul-flat); font-size:14px;">${k_ha.toFixed(1)} kg/ha</b><br><span style="color:#888;">${k_tot.toFixed(1)} kg/talhão<br>${k_pl.toFixed(0)} g/planta</span></td></tr>`;
            cronogramaFinal.push({ mes: d.mes, n: u_tot, p: m_tot, k: k_tot, fn: ftN.n, fp: ftP.n, fk: ftK.n });
        });
    }
    if(tabela) tabela.innerHTML = bodyHTML;
}

function imprimirLaudo() { document.body.classList.add('modo-laudo'); window.print(); document.body.classList.remove('modo-laudo'); }

function enviarParaAplicacoes() {
    if (cronogramaFinal.length === 0) { alert("Calcule a recomendação primeiro!"); return; }
    if (!confirm("Deseja enviar este cronograma para Aplicações Planejadas?")) return;

    const cEl = document.getElementById('calc_talhao'); const talhao = cEl ? cEl.value : ''; 
    const anoAtual = new Date().getFullYear();

    cronogramaFinal.forEach(item => {
        let dataApp = `${anoAtual}-10-01`; 
        if(item.mes.includes("Plantio")) dataApp = hojeLocal();
        if(item.mes.includes("Jan")) dataApp = `${anoAtual+1}-01-15`;
        if(item.mes.includes("Mar")) dataApp = `${anoAtual+1}-03-15`;
        if(item.mes.includes("Nov")) dataApp = `${anoAtual}-11-15`;

        let adubos = [ { nome: item.fn, qtd: item.n }, { nome: item.fp, qtd: item.p }, { nome: item.fk, qtd: item.k } ];
        adubos.forEach(adubo => {
            if (adubo.qtd > 0) { agriRecords.push({ id: generateUUID(), updatedAt: Date.now(), deleted: false, data: dataApp, talhao: talhao, produto: adubo.nome, tipo: "ADUBO", alvo: "NUTRIÇÃO", dosagem: `${adubo.qtd.toFixed(1)} KG`, dosagem_qtd: parseFloat(adubo.qtd.toFixed(1)), dosagem_un: "KG", forma: "MANUAL", status: "PLANEJADO", custo_unit: 0, obs: "Importação Calc. Solo" }); }
        });
    });

    salvarDados(); try{aplicarFiltroSafraApp();}catch(e){} mostrarToast("Enviado para Aplicações!");
}

/* -------------------------------------------------------------------------
   9. FOCO, SUGESTÕES DE PRODUTO, ORDENAÇÃO DO ESTOQUE E RELATÓRIO
------------------------------------------------------------------------- */
function focarPrimeiroCampo(id) {
    setTimeout(() => { const el = document.getElementById(id); if (el) el.focus(); }, 60);
}

function mostrarSugestoesProduto() {
    const box = document.getElementById('sug_produto'); const inp = document.getElementById('produto');
    if (!box || !inp) return;
    const termo = inp.value.trim().toUpperCase();
    const itens = estoque.filter(e => e && !e.deleted && e.produto && (!termo || String(e.produto).toUpperCase().includes(termo)))
        .sort((a, b) => String(a.produto).localeCompare(String(b.produto), 'pt-BR'));
    box.innerHTML = itens.length
        ? itens.map(e => { const q = parseFloat(e.qtd) || 0; return `<div class="item-sug" onmousedown="escolherProdutoEstoque('${e.id}')"><span>${strEscape(e.produto)}</span><small class="${q <= 0 ? 'zerado' : ''}">${q.toFixed(2)} ${strEscape(e.un)}</small></div>`; }).join('')
        : '<div class="sem-sug">Nenhum produto do estoque encontrado</div>';
    box.style.display = 'block';
}

function esconderSugestoesProduto() { const box = document.getElementById('sug_produto'); if (box) box.style.display = 'none'; }

function escolherProdutoEstoque(id) {
    const e = estoque.find(x => x && x.id === id); if (!e) return;
    setVal('produto', e.produto);
    if (e.tipo) setVal('tipo', e.tipo);
    if (e.un) setVal('dosagem_un', e.un);
    esconderSugestoesProduto();
    const q = document.getElementById('dosagem_qtd'); if (q) q.focus();
}

function sortEstoque(col) {
    if (estSortCol === col) estSortAsc = !estSortAsc; else { estSortCol = col; estSortAsc = true; }
    saveAndRenderEstoque();
}

function popularFiltrosRelAgri() {
    const sel = document.getElementById('rel_agri_talhao'); if (!sel) return;
    const set = new Set(opcoesDin.talhoes || []);
    agriRecords.forEach(r => { if (r && !r.deleted && r.talhao && r.talhao !== '-') set.add(r.talhao); });
    const atual = sel.value;
    sel.innerHTML = '<option value="">TODOS OS TALHÕES</option>' + Array.from(set).sort().map(t => `<option value="${strEscape(t)}">${strEscape(t)}</option>`).join('');
    sel.value = atual;
    if (!safeVal('rel_agri_ini')) { const h = hojeLocal(); setVal('rel_agri_ini', h.substring(0, 8) + '01'); setVal('rel_agri_fim', h); }
}

function gerarRelatorioAgri() {
    const ini = sanitizeDateString(safeVal('rel_agri_ini')); const fim = sanitizeDateString(safeVal('rel_agri_fim')); const talhao = safeVal('rel_agri_talhao');
    if (!ini || !fim) { alert("Informe a data de início e a data de fim."); return; }
    if (ini > fim) { alert("A data de início não pode ser maior que a data de fim."); return; }

    const lista = agriRecords.filter(r => {
        if (!r || r.deleted) return false;
        const d = sanitizeDateString(r.data);
        if (!d || d < ini || d > fim) return false;
        if (talhao && r.talhao !== talhao) return false;
        return true;
    }).sort((a, b) => sanitizeDateString(a.data).localeCompare(sanitizeDateString(b.data)));

    let html = ''; let total = 0, totalAplicado = 0, totalPlanejado = 0;
    lista.forEach(rec => {
        const custo = custoAplicacao(rec); total += custo;
        if (rec.status === 'APLICADO') totalAplicado += custo; else totalPlanejado += custo;
        html += `<tr${estiloLinhaTalhao(rec.talhao)}><td>${formatarData(rec.data)}</td>${celTalhao(rec.talhao)}<td><b>${strEscape(rec.produto)}</b></td><td>${strEscape(rec.tipo)}</td><td>${strEscape(rec.alvo) || '-'}</td><td>${strSafe(rec.dosagem)}</td><td>${strEscape(rec.forma) || '-'}</td><td>${strSafe(rec.status)}</td><td style="text-align:right; font-family:'Rubik'; font-weight:700;">${formatarMoeda(custo)}</td></tr>`;
    });
    if (html) html += `<tr style="background:#f0f0f0; border-top:2px solid #ccc;"><td colspan="8" style="font-weight:700; text-align:right;">TOTAL DO PERÍODO</td><td style="text-align:right; font-family:'Rubik'; font-weight:700;">${formatarMoeda(total)}</td></tr>`;

    document.getElementById('tbody_rel_agri').innerHTML = html || '<tr><td colspan="9" style="text-align:center; padding:30px; color:#aaa;">Nenhuma aplicação encontrada neste período</td></tr>';
    document.getElementById('rel_agri_totais').innerHTML =
        `<div><span>Registros</span><b>${lista.length}</b></div><div><span>Aplicado</span><b>${formatarMoeda(totalAplicado)}</b></div><div><span>Planejado</span><b>${formatarMoeda(totalPlanejado)}</b></div><div><span>Custo Total</span><b style="color:var(--cor-laranja-flat);">${formatarMoeda(total)}</b></div>`;
    document.getElementById('rel_agri_cabecalho').innerHTML =
        `<h3 style="margin:0 0 5px 0;">RELATÓRIO DE APLICAÇÕES - RANCHO 3C</h3><div style="font-size:13px;">Talhão: <b>${strEscape(talhao || 'TODOS')}</b> &nbsp;|&nbsp; Período: <b>${formatarData(ini)}</b> a <b>${formatarData(fim)}</b></div>`;
}

/* =========================================================================
   10. SINCRONIZAÇÃO POR ID, BACKUP, ESTOQUE, TALHÕES E ALERTAS
========================================================================= */
function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; } return (h >>> 0).toString(36); }

// Mescla por ID (última edição vence). Registros antigos sem ID ganham um ID estável derivado do conteúdo.
// Registros antigos (sem prefixo v2-) com o mesmo conteúdo continuam sendo unificados, como antes.
function unificarPorId(localArr, cloudArr, hashFn) {
    const map = new Map();
    const adicionar = item => {
        if (!item) return;
        if (!item.id) item.id = 'L' + djb2(hashFn(item));
        const ex = map.get(item.id);
        if (!ex || (item.updatedAt || 0) >= (ex.updatedAt || 0)) map.set(item.id, item);
    };
    (cloudArr || []).forEach(adicionar);
    (localArr || []).forEach(adicionar);

    const resultado = []; const legado = new Map();
    map.forEach(item => {
        if (String(item.id).startsWith('v2-')) { resultado.push(item); return; }
        const h = hashFn(item); const ex = legado.get(h);
        if (!ex) { legado.set(h, item); return; }
        const ta = item.updatedAt || 0, tb = ex.updatedAt || 0;
        legado.set(h, ta !== tb ? (ta > tb ? item : ex) : (item.deleted ? item : ex));
    });
    legado.forEach(i => resultado.push(i));

    // Exclusões ficam registradas (para propagar entre aparelhos) e são limpas após 90 dias
    const limite = Date.now() - 90 * 86400000;
    return resultado.filter(i => !(i.deleted && i.updatedAt && i.updatedAt < limite));
}

function garantirOpcoes() {
    if (!opcoesDin || typeof opcoesDin !== 'object') opcoesDin = {};
    ['talhoes', 'tipos', 'formas', 'alvos'].forEach(k => { if (!Array.isArray(opcoesDin[k])) opcoesDin[k] = []; });
    if (!opcoesDin.talhoesInfo || typeof opcoesDin.talhoesInfo !== 'object') opcoesDin.talhoesInfo = {};
    if (!opcoesDin.cad || typeof opcoesDin.cad !== 'object') opcoesDin.cad = {};
    cadChaves().forEach(k => { if (!opcoesDin.cad[k] || typeof opcoesDin.cad[k] !== 'object') opcoesDin.cad[k] = {}; });
}

function mesclarOpcoes(opBruto) {
    if (!opBruto || typeof opBruto !== 'object') return; garantirOpcoes();
    const op = desempacotarOpcoes(opBruto);
    ['tipos', 'formas', 'alvos'].forEach(k => { opcoesDin[k] = [...new Set([...listaSegura(opcoesDin[k]), ...listaSegura(op[k])])].sort(); });
    // Talhões antigos (lista simples) só entram se nunca foram cadastrados nem removidos
    listaSegura(op.talhoes).forEach(n => { const nn = cadNorm(n); if (nn && !opcoesDin.cad.talhao[nn]) opcoesDin.cad.talhao[nn] = { u: 0, d: false }; });
    // Cadastros: vale o registro mais recente de cada item (inclusive remoções)
    const cad = (op.cad && typeof op.cad === 'object') ? op.cad : {};
    cadChaves().forEach(k => {
        const remoto = (cad[k] && typeof cad[k] === 'object') ? cad[k] : {};
        Object.keys(remoto).forEach(n => {
            const r = remoto[n]; const l = opcoesDin.cad[k][n];
            if (r && typeof r === 'object' && (!l || (r.u || 0) > (l.u || 0))) opcoesDin.cad[k][n] = { u: r.u || 0, d: !!r.d };
        });
    });
    const info = (op.talhoesInfo && typeof op.talhoesInfo === 'object') ? op.talhoesInfo : {};
    Object.keys(info).forEach(n => {
        const r = info[n]; if (!r || typeof r !== 'object') return; const l = opcoesDin.talhoesInfo[n];
        if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) opcoesDin.talhoesInfo[n] = r;
    });
    sincronizarTalhoesDerivados();
}

function atualizarTudo() {
    try { preencherSelectsLancamento(); popularSeletorSolo(); preencherSelectsSafraFin(); renderDatalistsAgri(); popularSeletorSafraApp(); atualizarOpcoesFiltros(); } catch (e) {}
    try { atualizarAlertas(); } catch (e) {}
}

/* ---------- Exportação ---------- */
function baixarArquivo(nome, conteudo, mime) {
    const blob = new Blob([conteudo], { type: mime });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

/* ---------- Estoque: entrada automática com custo médio ---------- */
function normalizarUnidadeEstoque(und, qtd) {
    const u = String(und || '').trim().toUpperCase().replace(/\./g, '');
    if (['L', 'LT', 'LTS', 'LITRO', 'LITROS'].includes(u)) return { un: 'L', qtd: qtd };
    if (['KG', 'KGS', 'K', 'QUILO', 'QUILOS'].includes(u)) return { un: 'KG', qtd: qtd };
    if (['G', 'GR', 'GRAMA', 'GRAMAS'].includes(u)) return { un: 'KG', qtd: qtd / 1000 };
    if (['ML'].includes(u)) return { un: 'L', qtd: qtd / 1000 };
    return null;
}

function entradaEstoque(produto, principio, tipo, qtd, un, valorUnit) {
    produto = String(produto || '').toUpperCase().trim();
    const est = estoque.find(e => e && !e.deleted && e.produto === produto && e.un === un);
    if (est) {
        const q0 = Math.max(0, parseFloat(est.qtd) || 0); const v0 = parseFloat(est.valor_unit) || 0; const total = q0 + qtd;
        est.valor_unit = total > 0 ? ((q0 * v0) + (qtd * valorUnit)) / total : valorUnit;
        est.qtd = (parseFloat(est.qtd) || 0) + qtd;
        if (!est.tipo && tipo) est.tipo = tipo;
        est.updatedAt = Date.now();
        return est.id;
    }
    const novo = { id: generateUUID(), updatedAt: Date.now(), deleted: false, produto: produto, principio: principio || '', tipo: tipo || 'INSUMOS', qtd: qtd, un: un, valor_unit: valorUnit, qtd_min: 0 };
    estoque.push(novo);
    return novo.id;
}

/* ---------- Custo congelado das aplicações ---------- */
function custoUnitarioAtual(rec) {
    const est = estoque.find(e => e && !e.deleted && e.produto === rec.produto && e.un === rec.dosagem_un);
    return est ? (parseFloat(est.valor_unit) || 0) : (parseFloat(rec.custo_unit) || 0);
}
function congelarCusto(rec) { const u = custoUnitarioAtual(rec); rec.custo_unit = u; rec.custo_fixo = u > 0; }
function custoAplicacao(rec) {
    const q = parseFloat(rec.dosagem_qtd) || 0;
    if (rec.status === 'APLICADO' && rec.custo_fixo) return q * (parseFloat(rec.custo_unit) || 0);
    return q * custoUnitarioAtual(rec);
}
function fixarCustosAntigos() {
    const pend = agriRecords.filter(r => r && !r.deleted && r.status === 'APLICADO' && !r.custo_fixo);
    if (!pend.length) { alert("Todas as aplicações já realizadas estão com o custo fixado."); return; }
    if (!confirm(`Fixar o custo de ${pend.length} aplicação(ões) já realizada(s) usando o preço ATUAL do estoque?\n\nDepois disso, mudanças de preço no estoque não alteram mais esses registros.`)) return;
    pend.forEach(r => { congelarCusto(r); r.updatedAt = Date.now(); });
    salvarDados(); aplicarFiltroSafraApp(); mostrarToast("Custos fixados!");
}

/* ---------- Talhões: alocação de despesas, cadastro e indicadores ---------- */
function nomesTalhaoSet() {
    return new Set([...(opcoesDin.talhoes || []), ...Object.keys(opcoesDin.talhoesInfo || {}), ...agriRecords.filter(r => r && !r.deleted && r.talhao && r.talhao !== '-').map(r => r.talhao), ...setoresLavoura].map(x => String(x).toUpperCase()));
}

// Divide o valor de um lançamento entre os talhões (campo Talhão; se vazio, usa o Setor quando ele for um talhão/lavoura)
function alocacaoTalhao(t) {
    if (t && t.est_mov) return []; // compra que entrou no estoque: o custo chega ao talhão pela Aplicação
    const v = parseFloat(t.valor) || 0; const r = rateioDe(t);
    if (r.length) { let acc = 0; return r.map((x, i) => { const val = i === r.length - 1 ? v - acc : v * x.pct / 100; acc += val; return { talhao: x.talhao, valor: val }; }); }
    if (String(t.tipo).toLowerCase() !== 'receita') {
        const setor = strSafe(t.setor).toUpperCase(); const lig = talhaoDoSetor(setor);
        if (lig) return [{ talhao: lig, valor: v }];
        if (setor && nomesTalhaoSet().has(setor)) return [{ talhao: setor, valor: v }];
    }
    return [];
}

function rotuloTalhao(t) {
    const r = rateioDe(t); if (!r.length) return '-';
    if (r.length === 1) return chipTalhao(r[0].talhao);
    return r.map(x => `${chipTalhao(x.talhao)} <small>${x.pct}%</small>`).join('<br>');
}

function infoTalhao(n) { const i = (opcoesDin.talhoesInfo || {})[String(n).toUpperCase()]; return (i && !i.deleted) ? i : null; }
function encAttr(s) { return encodeURIComponent(s).replace(/'/g, '%27'); }

function listaTodosTalhoes() { return cadLista('talhao'); }

function salvarTalhao(e) {
    e.preventDefault();
    const nome = safeVal('tl_nome').trim().toUpperCase(); if (!nome) return;
    garantirOpcoes(); verificarNovaOpcao('talhoes', nome);
    opcoesDin.talhoesInfo[nome] = { cultura: safeVal('tl_cultura'), area: parseFloat(safeVal('tl_area')) || 0, plantas: parseFloat(safeVal('tl_plantas')) || 0, updatedAt: Date.now(), deleted: false };
    salvarDados(); document.getElementById('form_talhao').reset();
    renderDatalistsAgri(); try { popularSeletorSafraApp(); } catch (err) {}
    renderTalhoes(); mostrarToast("Talhão salvo!"); focarPrimeiroCampo('tl_nome');
}

function editarTalhao(enc) {
    const n = decodeURIComponent(enc); const i = infoTalhao(n);
    setVal('tl_nome', n); setVal('tl_cultura', i && i.cultura ? i.cultura : 'conilon'); setVal('tl_area', i && i.area ? i.area : ''); setVal('tl_plantas', i && i.plantas ? i.plantas : '');
    const el = document.getElementById('tl_area'); if (el) el.focus();
}

function excluirTalhao(enc) { cadRemoverItem('talhao', enc); }

function renderTalhoes() { renderIndicadoresTalhao(); }

function renderIndicadoresTalhao() {
    const sel = document.getElementById('ind_safra'); if (!sel) return;
    const safras = new Set();
    agriRecords.forEach(r => { if (r && !r.deleted && r.data) safras.add(obterSafraGeral(r.data)); });
    transacoes.forEach(t => { if (t && !t.deleted && t.data) safras.add(obterSafraGeral(t.data)); });
    safras.delete('Sem Data');
    const atual = sel.value || obterSafraAtual();
    sel.innerHTML = '<option value="TODAS">TODAS AS SAFRAS</option>' + Array.from(safras).sort().reverse().map(s => `<option value="${s}">Safra ${s}</option>`).join('');
    sel.value = (atual === 'TODAS' || safras.has(atual)) ? atual : 'TODAS';
    const safraSel = sel.value;

    const ind = {};
    const get = n => { if (!ind[n]) ind[n] = { app: 0, caixa: 0, receita: 0, sacas: 0 }; return ind[n]; };
    agriRecords.forEach(r => {
        if (!r || r.deleted || r.status !== 'APLICADO' || !r.talhao || r.talhao === '-') return;
        if (safraSel !== 'TODAS' && obterSafraGeral(r.data) !== safraSel) return;
        get(String(r.talhao).toUpperCase()).app += custoAplicacao(r);
    });
    transacoes.forEach(t => {
        if (!t || t.deleted) return;
        if (safraSel !== 'TODAS' && obterSafraGeral(t.data) !== safraSel) return;
        const tipo = String(t.tipo).toLowerCase();
        if (tipo === 'despesa') alocacaoTalhao(t).forEach(a => { get(a.talhao).caixa += a.valor; });
        else if (tipo === 'receita') {
            const tl = strSafe(t.talhao).toUpperCase(); if (!tl || tl === '-') return;
            const o = get(tl); o.receita += parseFloat(t.valor) || 0;
            if (String(t.und).trim().toUpperCase() === 'SC') o.sacas += parseFloat(t.qtd) || 0;
        }
    });

    let html = ''; const tot = { area: 0, plantas: 0, app: 0, caixa: 0, receita: 0, sacas: 0, custoComArea: 0 };
    listaTodosTalhoes().forEach(n => {
        const i = infoTalhao(n); const v = ind[n] || { app: 0, caixa: 0, receita: 0, sacas: 0 };
        const area = i ? (parseFloat(i.area) || 0) : 0; const plantas = i ? (parseFloat(i.plantas) || 0) : 0;
        const custo = v.app + v.caixa; const res = v.receita - custo;
        tot.area += area; tot.plantas += plantas; tot.app += v.app; tot.caixa += v.caixa; tot.receita += v.receita; tot.sacas += v.sacas; if (area > 0) tot.custoComArea += custo;
        const enc = encAttr(n); const col = prodGet(safraSel, n), un = unidadeColheita(n);
        html += `<tr${estiloLinhaTalhao(n)}>${celTalhao(n)}<td>${i && i.cultura ? (i.cultura === 'maracuja' ? 'MARACUJÁ' : 'CONILON') : '-'}</td>
            <td>${area > 0 ? area.toFixed(2) : '-'}</td><td>${plantas > 0 ? plantas.toLocaleString('pt-BR') : '-'}</td>
            <td>${formatarMoeda(v.app)}</td><td>${formatarMoeda(v.caixa)}</td><td style="font-weight:700;">${formatarMoeda(custo)}</td>
            <td>${area > 0 ? formatarMoeda(custo / area) : '-'}</td><td>${formatarMoeda(v.receita)}</td>
            <td style="font-weight:700; color:${res >= 0 ? '#27ae60' : '#c0392b'};">${formatarMoeda(res)}</td>
            <td>${col > 0 ? col.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ' + un : '-'}</td><td>${col > 0 && custo > 0 ? formatarMoeda(custo / col) + '/' + un : '-'}</td>
            <td class="no-print" style="text-align:center;"><button class="btn-acao btn-editar" onclick="editarTalhao('${enc}')">✏️</button><button class="btn-acao btn-excluir" title="Remover talhão" onclick="excluirTalhao('${enc}')">🗑️</button></td></tr>`;
    });
    const custoTot = tot.app + tot.caixa; const resTot = tot.receita - custoTot;
    if (html) html += `<tr style="background:#f0f0f0; border-top:2px solid #ccc; font-weight:700;"><td>TOTAL</td><td></td><td>${tot.area > 0 ? tot.area.toFixed(2) : '-'}</td><td>${tot.plantas > 0 ? tot.plantas.toLocaleString('pt-BR') : '-'}</td>
        <td>${formatarMoeda(tot.app)}</td><td>${formatarMoeda(tot.caixa)}</td><td>${formatarMoeda(custoTot)}</td><td>${tot.area > 0 ? formatarMoeda(tot.custoComArea / tot.area) : '-'}</td>
        <td>${formatarMoeda(tot.receita)}</td><td style="color:${resTot >= 0 ? '#27ae60' : '#c0392b'};">${formatarMoeda(resTot)}</td><td>-</td><td>-</td><td class="no-print"></td></tr>`;
    document.getElementById('tbody_indicadores').innerHTML = html || '<tr><td colspan="13" style="text-align:center; padding:30px; color:#aaa;">Cadastre um talhão para começar</td></tr>';
}

/* ---------- Alertas: contas e estoque ---------- */
function atualizarAlertas() {
    const hoje = hojeLocal();
    const d = new Date(); d.setDate(d.getDate() + 7);
    const lim = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    let pagVenc = 0, pagVencV = 0, pag7 = 0, pag7V = 0, recVenc = 0, recVencV = 0;
    transacoes.forEach(t => {
        if (!t || t.deleted) return;
        const sit = strSafe(t.sit).toLowerCase();
        if (!(sit.includes('pagar') || sit.includes('receber') || sit.includes('pendente'))) return;
        const data = sanitizeDateString(t.data); if (!data) return;
        const v = parseFloat(t.valor) || 0;
        if (String(t.tipo).toLowerCase() === 'receita') { if (data < hoje) { recVenc++; recVencV += v; } }
        else if (data < hoje) { pagVenc++; pagVencV += v; }
        else if (data <= lim) { pag7++; pag7V += v; }
    });
    const baixo = estoque.filter(e => { if (!e || e.deleted || !e.produto) return false; const q = parseFloat(e.qtd) || 0; const m = parseFloat(e.qtd_min) || 0; return q < demandaPendente(e) || (m > 0 && q < m); }).length;

    const badge = (id, n) => { const el = document.getElementById(id); if (!el) return; if (n > 0) { el.innerText = n; el.style.display = 'inline-block'; } else el.style.display = 'none'; };
    badge('badge_atrasadas', pagVenc); badge('badge_estoque', baixo); try { atualizarMarcasMenu(); } catch (e2) {}

    const box = document.getElementById('alertas_pendencias');
    if (box) {
        const sub = 'font-size:12px; opacity:0.9; margin-top:6px;';
        box.innerHTML = `
            <div class="card" style="background-color: var(--cor-vermelho-flat);"><h4>A pagar vencidas</h4><span>${formatarMoeda(pagVencV)}</span><div style="${sub}">${pagVenc} lançamento(s)</div></div>
            <div class="card" style="background-color: var(--cor-laranja-flat);"><h4>A pagar em 7 dias</h4><span>${formatarMoeda(pag7V)}</span><div style="${sub}">${pag7} lançamento(s)</div></div>
            <div class="card" style="background-color: var(--cor-azul-flat);"><h4>A receber vencidas</h4><span>${formatarMoeda(recVencV)}</span><div style="${sub}">${recVenc} lançamento(s)</div></div>
            <div class="card" style="background-color: var(--cor-roxo-flat);"><h4>Estoque abaixo do mínimo</h4><span>${baixo}</span><div style="${sub}">item(ns) a repor</div></div>`;
    }
}


/* =========================================================================
   11. CADASTROS, JANELAS DE LANÇAMENTO E CASCATA EM NÍVEIS
========================================================================= */
const CADASTROS_DEF = [
    { chave: 'categoria_despesa', hier: true, grupo: 'despesa', titulo: 'Categoria',  plural: 'Categorias',   icone: '🏷️', cor: 'var(--cor-laranja-flat)' },
    { chave: 'setor', hier: true,             grupo: 'despesa', titulo: 'Setor',      plural: 'Setores',      icone: '🚜', cor: 'var(--cor-laranja-flat)' },
    { chave: 'talhao',            grupo: 'despesa', titulo: 'Talhão',     plural: 'Talhões',      icone: '🌾', cor: 'var(--cor-laranja-flat)' },
    { chave: 'fornecedor',        grupo: 'despesa', titulo: 'Fornecedor', plural: 'Fornecedores', icone: '🏪', cor: 'var(--cor-laranja-flat)' },
    { chave: 'produto_receita',   grupo: 'receita', titulo: 'Produto',    plural: 'Produtos',     icone: '🌱', cor: 'var(--cor-verde-flat)' },
    { chave: 'cliente',           grupo: 'receita', titulo: 'Cliente',    plural: 'Clientes',     icone: '🤝', cor: 'var(--cor-verde-flat)' },
    { chave: 'unidade',           grupo: 'geral',   titulo: 'Unidade',    plural: 'Unidades',     icone: '⚖️', cor: 'var(--cor-azul-flat)' }
];

// Campo do formulário -> cadastro que o alimenta
const CAMPOS_CAD = { d_categoria: 'categoria_despesa', d_setor: 'setor', d_talhao: 'talhao', d_talhao2: 'talhao', d_talhao3: 'talhao', d_talhao4: 'talhao', d_local: 'fornecedor', r_categoria: 'produto_receita', r_local: 'cliente', r_talhao: 'talhao', d_und: 'unidade', r_und: 'unidade' };

function cadNorm(v) { const s = strSafe(v).toUpperCase().replace(/\s+/g, ' '); return s === '-' ? '' : s; }
function cadLista(chave) {
    garantirOpcoes(); const m = opcoesDin.cad[chave] || {};
    return Object.keys(m).filter(n => m[n] && !m[n].d).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function cadTem(chave, nome) {
    const n = cadNorm(nome); if (!n) return false; garantirOpcoes();
    const e = (opcoesDin.cad[chave] || {})[n]; return !!(e && !e.d);
}
function sincronizarTalhoesDerivados() { opcoesDin.talhoes = cadLista('talhao'); }
function cadAdicionar(chave, nome) {
    const n = cadNorm(nome); if (!n) return false; garantirOpcoes();
    opcoesDin.cad[chave][n] = { u: Date.now(), d: false };
    if (chave === 'talhao') { sincronizarTalhoesDerivados(); if (!temCorTalhao(n)) setCorTalhao(n, corLivreTalhao()); }
    return true;
}
function cadRemover(chave, nome) {
    const n = cadNorm(nome); if (!n) return false; garantirOpcoes();
    opcoesDin.cad[chave][n] = { u: Date.now(), d: true };
    if (chave === 'categoria_despesa' || chave === 'setor') desvincularTodos(chave, n);
    if (chave === 'talhao') { opcoesDin.talhoesInfo[n] = { deleted: true, updatedAt: Date.now() }; sincronizarTalhoesDerivados(); }
    return true;
}

// Cria os cadastros a partir do que já existe (padrões do sistema + histórico), sem ressuscitar itens removidos
function semearCadastros() {
    garantirOpcoes();
    const add = (chave, v) => { const n = cadNorm(v); if (!n) return; if (!opcoesDin.cad[chave][n]) opcoesDin.cad[chave][n] = { u: 0, d: false }; };
    dCategoriasPadrao.forEach(v => add('categoria_despesa', v));
    dSetoresPadrao.forEach(v => add('setor', v));
    rCategoriasPadrao.forEach(v => add('produto_receita', v));
    UNIDADES_PADRAO.forEach(v => add('unidade', v));
    estoque.forEach(e => { if (e && !e.deleted) add('unidade', e.un); });
    (opcoesDin.talhoes || []).forEach(v => add('talhao', v));
    Object.keys(opcoesDin.talhoesInfo || {}).forEach(k => { if (infoTalhao(k)) add('talhao', k); });
    agriRecords.forEach(r => { if (r && !r.deleted) add('talhao', r.talhao); });
    analisesSolo.forEach(a => { if (a && !a.deleted) add('talhao', a.talhao); });
    transacoes.forEach(t => {
        if (!t || t.deleted) return;
        if (String(t.tipo).toLowerCase() === 'receita') { add('produto_receita', t.categoria); add('cliente', t.local); }
        else { add('categoria_despesa', t.categoria); add('setor', t.setor); add('fornecedor', t.local); }
        talhoesDe(t).forEach(x => add('talhao', x)); add('unidade', t.und);
    });
    sincronizarTalhoesDerivados();
}

function cadUsos(chave) {
    const c = {}; const inc = v => { const n = cadNorm(v); if (n) c[n] = (c[n] || 0) + 1; };
    transacoes.forEach(t => {
        if (!t || t.deleted) return; const rec = String(t.tipo).toLowerCase() === 'receita';
        if (chave === 'categoria_despesa' && !rec) inc(t.categoria);
        else if (chave === 'setor' && !rec) inc(t.setor);
        else if (chave === 'fornecedor' && !rec) inc(t.local);
        else if (chave === 'produto_receita' && rec) inc(t.categoria);
        else if (chave === 'cliente' && rec) inc(t.local);
        else if (chave === 'unidade') inc(t.und);
        else if (chave === 'talhao') { talhoesDe(t).forEach(x => inc(x)); }
    });
    if (chave === 'talhao') agriRecords.forEach(r => { if (r && !r.deleted) inc(r.talhao); });
    return c;
}

function atualizarListasAposCadastro() {
    try { preencherSelectsLancamento(); renderDatalistsAgri(); popularSeletorSafraApp(); popularSeletorSolo(); atualizarOpcoesFiltros(); } catch (e) {}
    revalidarCadastros();
}

/* ---------- Tela de Cadastros ---------- */
function renderCadastros() {
    const cont = document.getElementById('cadastros_conteudo'); if (!cont) return;
    const card = d => `
        <div class="widget-box cad-card" style="border-top: 4px solid ${d.cor};">
            <div class="widget-header" style="border:none; margin-bottom:8px; padding-bottom:0;">
                <span>${d.icone} ${d.plural}</span><span class="cad-contagem" id="cad_cont_${d.chave}"></span>
            </div>
            <form class="cad-form" onsubmit="cadSubmeter(event, '${d.chave}')">
                <input type="text" id="cad_in_${d.chave}" placeholder="Buscar ou cadastrar" autocomplete="off" oninput="renderListaCadastro('${d.chave}')">
                <button type="submit" class="btn-salvar-compacto" style="background:${d.cor};">Adicionar</button>
            </form>
            <ul class="cad-lista" id="cad_lista_${d.chave}"></ul>
        </div>`;
    const grupo = g => CADASTROS_DEF.filter(d => d.grupo === g && !d.hier).map(card).join('');
    cont.innerHTML = `
        <h3 class="cad-titulo" style="color: var(--cor-laranja-flat);">🚜 Despesas</h3><div class="cad-grid">${htmlHierarquia()}${grupo('despesa')}</div>
        <h3 class="cad-titulo" style="color: var(--cor-verde-flat);">🌱 Receitas</h3><div class="cad-grid">${grupo('receita')}</div>
        <h3 class="cad-titulo" style="color: var(--cor-azul-flat);">⚖️ Geral</h3><div class="cad-grid">${grupo('geral')}</div>`;
    CADASTROS_DEF.forEach(d => renderListaCadastro(d.chave)); renderHierarquia();
}

function renderListaCadastro(chave) {
    const ul = document.getElementById('cad_lista_' + chave); if (!ul) return;
    const def = CADASTROS_DEF.find(d => d.chave === chave);
    const termo = cadNorm(safeVal('cad_in_' + chave));
    const todos = cadLista(chave); const usos = cadUsos(chave);
    const lista = termo ? todos.filter(n => n.includes(termo)) : todos;
    let html = '';
    if (termo && !todos.includes(termo)) html += `<li class="cad-dica">➕ Clique em <b>Adicionar</b> para cadastrar “${strEscape(termo)}”</li>`;
    html += lista.map(n => `<li class="cad-item"><span class="cad-nome">${strEscape(n)}</span><span class="cad-uso">${usos[n] ? usos[n] + ' uso(s)' : 'sem uso'}</span><button type="button" class="btn-acao btn-editar" title="Renomear" onclick="cadRenomearItem('${chave}', '${encAttr(n)}')">✏️</button><button type="button" class="btn-acao btn-excluir" title="Remover do cadastro" onclick="cadRemoverItem('${chave}', '${encAttr(n)}')">🗑️</button></li>`).join('');
    if (!html) html = `<li class="cad-dica">Nenhum item cadastrado</li>`;
    ul.innerHTML = html;
    const c = document.getElementById('cad_cont_' + chave); if (c) c.innerText = todos.length + ' ' + (todos.length === 1 ? 'item' : 'itens');
}

function cadSubmeter(e, chave) {
    e.preventDefault();
    const n = cadNorm(safeVal('cad_in_' + chave)); if (!n) return;
    const def = CADASTROS_DEF.find(d => d.chave === chave);
    if (cadTem(chave, n)) { mostrarToast(def.titulo + ' já cadastrado!'); return; }
    cadAdicionar(chave, n); salvarDados();
    setVal('cad_in_' + chave, ''); renderListaCadastro(chave); atualizarListasAposCadastro();
    mostrarToast(def.titulo + ' cadastrado!'); focarPrimeiroCampo('cad_in_' + chave);
}

function cadRemoverItem(chave, enc) {
    const n = decodeURIComponent(enc); const def = CADASTROS_DEF.find(d => d.chave === chave);
    const usos = cadUsos(chave)[n] || 0;
    let msg = `Remover "${n}" do cadastro de ${def.plural.toLowerCase()}?\n\n` +
        (usos ? `${usos} registro(s) já usam este item e NÃO serão alterados. ` : '') +
        `O item apenas deixa de ser oferecido em novos lançamentos.`;
    if (chave === 'talhao') msg += `\nA área e o nº de plantas cadastrados também serão removidos.`;
    if (!confirm(msg)) return;
    cadRemover(chave, n); salvarDados();
    renderListaCadastro(chave); atualizarListasAposCadastro(); try { renderHierarquia(); } catch (e) {}
    try { renderTalhoes(); } catch (e) {}
    mostrarToast(def.titulo + ' removido do cadastro');
}

/* ---------- Validação: campos só aceitam itens cadastrados ---------- */
function validarCampoCad(id, chave) {
    const el = document.getElementById(id); if (!el) return true;
    const v = cadNorm(el.value); let ok = !v || cadTem(chave, v); let msg = 'Item não cadastrado. Cadastre-o na tela Cadastros.';
    if (ok && id === 'd_setor' && !setorValidoParaCategoria(safeVal('d_categoria'), v)) { ok = false; msg = 'Este setor não pertence à categoria escolhida.'; }
    el.setCustomValidity(ok ? '' : msg);
    el.classList.toggle('nao-cadastrado', !ok);
    return ok;
}
function vincularValidacaoCadastro() {
    Object.keys(CAMPOS_CAD).forEach(id => {
        const el = document.getElementById(id); if (!el || el.dataset.cadVinc) return;
        el.dataset.cadVinc = '1';
        const h = () => validarCampoCad(id, CAMPOS_CAD[id]);
        el.addEventListener('input', h); el.addEventListener('change', h);
    });
}
function revalidarCadastros() { Object.keys(CAMPOS_CAD).forEach(id => validarCampoCad(id, CAMPOS_CAD[id])); }

/* ---------- Janelas flutuantes do Caixa ---------- */
let modalFecharApos = false;

function abrirModalLancamento(tipo) {
    preencherSelectsLancamento(); vincularValidacaoCadastro(); atualizarAvisoInsumo();
    const ehRec = tipo === 'receita'; const p = ehRec ? 'r_' : 'd_';
    if (!safeVal(p + 'data')) setVal(p + 'data', hojeLocal());
    if (!ehRec) mudarTemaSaida();
    document.getElementById(ehRec ? 'modal-receita' : 'modal-despesa').style.display = 'flex';
    revalidarCadastros();
    const faltam = ehRec ? (cadLista('produto_receita').length === 0 || cadLista('cliente').length === 0)
                         : (cadLista('categoria_despesa').length === 0 || cadLista('setor').length === 0 || cadLista('fornecedor').length === 0);
    if (faltam) mostrarToast("Cadastre os itens na tela Cadastros antes de lançar");
    focarPrimeiroCampo(p + 'data');
}

function fecharModalLancamento(tipo) {
    const m = document.getElementById(tipo === 'receita' ? 'modal-receita' : 'modal-despesa'); if (m) m.style.display = 'none';
}

function irParaCadastros(tipo) { fecharModalLancamento(tipo); showTab('cadastros_main'); }

/* ---------- Cascata em níveis ---------- */
let cascataSel = [];

function cascataCategoria(t, ehRec) {
    let c = strSafe(t.categoria); if (!c || c === '-') c = ehRec ? strSafe(t.desc) : strSafe(t.setor);
    return c.toUpperCase() || 'SEM CATEGORIA';
}

function cascataNiveis(ehRec) {
    const txt = v => { const s = strSafe(v).toUpperCase(); return (!s || s === '-') ? '' : s; };
    const simples = (fn, rotVazio) => (t, v) => { const s = fn(t); return [{ k: s || rotVazio, v: v, vazio: !s }]; };
    const niveis = [
        { rot: ehRec ? 'Produtos' : 'Categorias', chaves: (t, v) => [{ k: cascataCategoria(t, ehRec), v: v }] },
        { rot: 'Itens (descrição)', chaves: simples(t => txt(t.desc), 'SEM DESCRIÇÃO') },
        { rot: ehRec ? 'Clientes' : 'Fornecedores', chaves: simples(t => txt(t.local), 'NÃO INFORMADO') }
    ];
    if (!ehRec) niveis.push({ rot: 'Setores', chaves: simples(t => txt(t.setor), 'NÃO INFORMADO') });
    niveis.push({ rot: 'Talhões', chaves: (t, v) => {
        const a = alocacaoTalhao(t);
        if (!a.length) return [{ k: 'NÃO INFORMADO', v: v, vazio: true }];
        return a.map(x => ({ k: x.talhao, v: x.valor }));
    } });
    niveis.push({ folha: true, rot: 'Lançamentos' });
    return niveis;
}

function cascataLinhasBase() {
    const filtroMes = safeVal('filtro_mes_relatorios'); const filtroSafra = safeVal('filtro_safra_relatorios');
    const tipoFiltro = safeVal('cascata_tipo').toLowerCase();
    return transacoes.filter(t => {
        if (!t || t.deleted) return false;
        if (!strSafe(t.sit).toLowerCase().includes('pago')) return false;
        if (filtroSafra && obterSafraGeral(t.data) !== filtroSafra) return false;
        if (filtroMes && (!t.data || !sanitizeDateString(t.data).startsWith(filtroMes))) return false;
        return String(t.tipo).toLowerCase() === tipoFiltro;
    }).map(t => ({ t: t, v: parseFloat(t.valor) || 0 }));
}

function cascataAgrupar(itens, nivel) {
    const mapa = new Map();
    itens.forEach(it => nivel.chaves(it.t, it.v).forEach(c => {
        let b = mapa.get(c.k);
        if (!b) { b = { chave: c.k, total: 0, n: 0, vazio: !!c.vazio, itens: [] }; mapa.set(c.k, b); }
        b.total += c.v; b.n++; b.itens.push({ t: it.t, v: c.v });
    }));
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

function cascataColunaLancamentos(itens, numero) {
    const ord = itens.slice().sort((a, b) => sanitizeDateString(b.t.data).localeCompare(sanitizeDateString(a.t.data)));
    const total = ord.reduce((s, i) => s + i.v, 0);
    const lis = ord.map(i => {
        const t = i.t; const q = parseFloat(t.qtd);
        const extra = [strSafe(t.desc) !== '' && t.desc !== '-' ? strEscape(t.desc) : '', strSafe(t.local) !== '' && t.local !== '-' ? '📍 ' + strEscape(t.local) : '', q > 0 ? `${q} ${strEscape(t.und)}` : ''].filter(Boolean).join(' · ');
        return `<li class="cascata-lanc"><div class="cascata-linha"><span>${formatarData(t.data)}</span><b>${formatarMoeda(i.v)}</b></div><div class="cascata-sub">${extra || '-'}</div></li>`;
    }).join('');
    return `<div class="cascata-coluna"><div class="cascata-titulo"><span>${numero}. Lançamentos</span><b>${formatarMoeda(total)}</b></div><ul>${lis}</ul></div>`;
}

function renderCascata() {
    const cont = document.getElementById('cascata_niveis'); if (!cont) return;
    const tipoFiltro = safeVal('cascata_tipo'); const ehRec = tipoFiltro.toLowerCase() === 'receita';
    const base = cascataLinhasBase();
    document.getElementById('cascata_total_geral').innerText = formatarMoeda(base.reduce((s, i) => s + i.v, 0));
    const cor = ehRec ? 'var(--cor-verde-flat)' : (tipoFiltro === 'Investimento' ? 'var(--cor-roxo-flat)' : 'var(--cor-laranja-flat)');

    let itens = base; let html = ''; let col = 0; const validas = [];
    for (const nivel of cascataNiveis(ehRec)) {
        if (!itens.length) break;
        if (nivel.folha) { html += cascataColunaLancamentos(itens, col + 2); break; }
        const buckets = cascataAgrupar(itens, nivel);
        if (buckets.length === 1 && buckets[0].vazio) continue; // nível sem informação: não aparece
        const subtotal = itens.reduce((s, i) => s + i.v, 0); const maximo = buckets[0].total;
        const escolhido = cascataSel[col]; const sel = buckets.find(b => b.chave === escolhido);
        html += `<div class="cascata-coluna"><div class="cascata-titulo"><span>${col + 2}. ${nivel.rot}</span><b>${formatarMoeda(subtotal)}</b></div><ul>` +
            buckets.map(b => {
                const perc = maximo > 0 ? (b.total / maximo) * 100 : 0; const part = subtotal > 0 ? (b.total / subtotal) * 100 : 0;
                return `<li class="cascata-item ${sel && sel.chave === b.chave ? 'sel' : ''}" onclick="cascataClicar(${col}, '${encAttr(b.chave)}')">
                    <div class="cascata-linha"><span>${strEscape(b.chave)}</span><b>${formatarMoeda(b.total)}</b></div>
                    <div class="cascata-sub">${b.n} lançamento(s) · ${part.toFixed(1)}%</div>
                    <div class="barra-grafico-container"><div style="background:${cor}; height:100%; border-radius:2px; width:${perc}%;"></div></div></li>`;
            }).join('') + `</ul></div>`;
        if (!sel) break;
        validas.push(sel.chave); itens = sel.itens; col++;
    }
    cascataSel = validas;
    cont.innerHTML = html || '<div class="cascata-vazio">Nenhum dado encontrado para o filtro.</div>';
}

function cascataClicar(col, enc) {
    const k = decodeURIComponent(enc);
    cascataSel = cascataSel[col] === k ? cascataSel.slice(0, col) : cascataSel.slice(0, col).concat([k]);
    renderCascata();
    const cont = document.getElementById('cascata_niveis');
    if (cont && cont.scrollTo) setTimeout(() => cont.scrollTo({ left: cont.scrollWidth, behavior: 'smooth' }), 50);
}

function renderCascataCategorias() { cascataSel = []; renderCascata(); }

function abrirDetalheCategoria(catEncoded, tipoFiltro) {
    const cat = decodeURIComponent(catEncoded);
    switchTab('relatorios_detalhados'); switchRelTab('cascata');
    if (tipoFiltro === 'Saida') {
        setVal('cascata_tipo', 'Despesa');
        if (!cascataLinhasBase().some(i => cascataCategoria(i.t, false) === cat)) setVal('cascata_tipo', 'Investimento');
    } else setVal('cascata_tipo', tipoFiltro);
    cascataSel = [cat]; renderCascata();
}

document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    ['modal-despesa', 'modal-receita', 'modal-edicao', 'modal-chuvas', 'modal-gd', 'modal-orcamento', 'modal-colheita'].forEach(id => { const m = document.getElementById(id); if (m && m.style.display === 'flex') m.style.display = 'none'; });
});
document.addEventListener('DOMContentLoaded', () => { try { vincularValidacaoCadastro(); } catch (e) {} });


/* =========================================================================
   12. LISTAS SUSPENSAS PRÓPRIAS, TRANSPORTE DOS CADASTROS E AJUSTE DE ÁREA
========================================================================= */

/* ---------- Transporte dos cadastros para a nuvem ----------
   A planilha garante guardar as listas simples (talhoes/tipos/formas/alvos). Para que cadastros e dados de
   talhões cheguem a todos os aparelhos mesmo que o script ignore campos novos, eles também viajam codificados
   dentro de "alvos". Ao ler da nuvem, essas linhas são separadas e nunca aparecem como alvos de aplicação. */
const PREFIXO_CAD = '~CAD|', PREFIXO_TAL = '~TAL|';

function listaSegura(v) {
    if (Array.isArray(v)) return v.map(x => String(x));
    if (typeof v === 'string' && v.trim()) return v.split(',').map(x => x.trim()).filter(Boolean);
    return [];
}

function empacotarOpcoes() {
    garantirOpcoes(); const extras = [];
    cadChaves().forEach(k => Object.keys(opcoesDin.cad[k]).forEach(n => {
        const e = opcoesDin.cad[k][n]; if (e && n) extras.push(`${PREFIXO_CAD}${k}|${e.d ? 1 : 0}|${e.u || 0}|${n}`);
    }));
    Object.keys(opcoesDin.talhoesInfo).forEach(n => {
        const i = opcoesDin.talhoesInfo[n]; if (!i) return;
        extras.push(`${PREFIXO_TAL}${i.deleted ? 1 : 0}|${i.updatedAt || 0}|${i.cultura || ''}|${i.area || 0}|${i.plantas || 0}|${n}`);
    });
    return Object.assign({}, opcoesDin, { alvos: opcoesDin.alvos.concat(extras) });
}

function desempacotarOpcoes(op) {
    const limpo = Object.assign({}, op); const alvos = [];
    const cad = (op.cad && typeof op.cad === 'object') ? JSON.parse(JSON.stringify(op.cad)) : {};
    const info = (op.talhoesInfo && typeof op.talhoesInfo === 'object') ? Object.assign({}, op.talhoesInfo) : {};
    listaSegura(op.alvos).forEach(s => {
        if (s.startsWith(PREFIXO_CAD)) {
            const p = s.split('|'); const chave = p[1]; const nome = p.slice(4).join('|'); const u = parseFloat(p[3]) || 0;
            if (!chave || !nome) return;
            if (!cad[chave] || typeof cad[chave] !== 'object') cad[chave] = {};
            const ex = cad[chave][nome]; if (!ex || u > (ex.u || 0)) cad[chave][nome] = { u: u, d: p[2] === '1' };
        } else if (s.startsWith(PREFIXO_TAL)) {
            const p = s.split('|'); const nome = p.slice(6).join('|'); const u = parseFloat(p[2]) || 0; if (!nome) return;
            const ex = info[nome]; if (ex && (ex.updatedAt || 0) >= u) return;
            info[nome] = p[1] === '1' ? { deleted: true, updatedAt: u } : { cultura: p[3] || 'conilon', area: parseFloat(p[4]) || 0, plantas: parseFloat(p[5]) || 0, updatedAt: u, deleted: false };
        } else alvos.push(s);
    });
    limpo.alvos = alvos; limpo.cad = cad; limpo.talhoesInfo = info;
    return limpo;
}

/* ---------- Lista suspensa própria (substitui o datalist nativo) ---------- */
let comboAtual = null, comboIdx = -1, comboSilencio = false;

function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }

function converterListasEmCombo(raiz) {
    (raiz || document).querySelectorAll('input[list]').forEach(el => {
        el.dataset.lista = el.getAttribute('list'); el.removeAttribute('list'); el.setAttribute('autocomplete', 'off');
    });
}

function comboElemento() {
    let d = document.getElementById('combo-lista');
    if (!d) {
        d = document.createElement('div'); d.id = 'combo-lista'; d.className = 'combo-lista';
        d.addEventListener('mousedown', ev => {
            ev.preventDefault();
            const link = ev.target.closest && ev.target.closest('.combo-link');
            if (link) { comboFechar(); fecharModalLancamento('despesa'); fecharModalLancamento('receita'); fecharModal(); showTab('cadastros_main'); return; }
            const it = ev.target.closest && ev.target.closest('.combo-item');
            if (it && comboAtual) comboEscolher(comboAtual, decodeURIComponent(it.dataset.v));
        });
        document.body.appendChild(d);
    }
    return d;
}

function comboOpcoes(inp) { const dl = document.getElementById(inp.dataset.lista); return dl ? Array.from(dl.options).map(o => o.value) : []; }

function comboAberto() { const d = document.getElementById('combo-lista'); return !!(d && d.style.display === 'block'); }

function comboFechar() { const d = document.getElementById('combo-lista'); if (d) d.style.display = 'none'; comboAtual = null; comboIdx = -1; }

function comboPosicionar() {
    if (!comboAtual) return; const box = comboElemento(); const r = comboAtual.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - 12; const acima = r.top - 12;
    box.style.left = r.left + 'px'; box.style.minWidth = Math.max(r.width, 200) + 'px';
    if (abaixo < 160 && acima > abaixo) { box.style.top = 'auto'; box.style.bottom = (window.innerHeight - r.top + 2) + 'px'; box.style.maxHeight = Math.min(280, acima) + 'px'; }
    else { box.style.bottom = 'auto'; box.style.top = (r.bottom + 2) + 'px'; box.style.maxHeight = Math.min(280, abaixo) + 'px'; }
}

function comboAbrir(inp, mostrarTodos) {
    if (!inp || !inp.dataset || !inp.dataset.lista) return;
    const todas = comboOpcoes(inp); const termo = semAcento(inp.value.trim());
    const exato = todas.some(o => semAcento(o) === termo);
    const lista = (mostrarTodos || !termo || exato) ? todas : todas.filter(o => semAcento(o).includes(termo));
    const restrito = !!CAMPOS_CAD[inp.id] || inp.id === 'ed_setor'; const semCat = /^(d|ed)_setor$/.test(inp.id) && !cadNorm(safeVal(inp.id.replace('setor', 'categoria'))); const box = comboElemento();
    comboAtual = inp; comboIdx = -1;
    if (!lista.length) {
        if (!restrito) { box.style.display = 'none'; return; }
        box.innerHTML = `<div class="combo-vazio">${semCat ? 'Escolha primeiro a categoria — os setores dependem dela.' : todas.length ? `Nenhum item cadastrado com “${strEscape(inp.value.trim())}”.` : 'Nenhum item cadastrado ainda.'}<br>Este campo aceita somente itens da tela de cadastros.<br><a href="#" class="combo-link" onclick="return false;">📝 Abrir Cadastros</a></div>`;
    } else {
        box.innerHTML = lista.map(o => `<div class="combo-item${semAcento(o) === termo ? ' ativo' : ''}" data-v="${encAttr(o)}">${strEscape(o)}</div>`).join('');
    }
    box.style.display = 'block'; comboPosicionar();
    const ativo = box.querySelector('.combo-item.ativo'); if (ativo) { comboIdx = Array.from(box.children).indexOf(ativo); ativo.scrollIntoView({ block: 'nearest' }); }
}

function comboEscolher(inp, valor) {
    comboSilencio = true;
    inp.value = valor;
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    comboSilencio = false; comboFechar();
}

function comboMover(delta) {
    const box = comboElemento(); const itens = Array.from(box.querySelectorAll('.combo-item')); if (!itens.length) return;
    comboIdx = (comboIdx + delta + itens.length) % itens.length;
    itens.forEach((el, i) => el.classList.toggle('ativo', i === comboIdx));
    itens[comboIdx].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('focusin', e => {
    const t = e.target; if (!t || !t.matches) return;
    if (t.matches('input[list]')) converterListasEmCombo(t.parentElement || document);
    if (t.matches('input[data-lista]')) comboAbrir(t);
    else if (!(t.closest && t.closest('#combo-lista'))) comboFechar();
});
document.addEventListener('click', e => { const t = e.target; if (t && t.matches && t.matches('input[data-lista]') && (comboAtual !== t || !comboAberto())) comboAbrir(t); });
document.addEventListener('input', e => { if (comboSilencio) return; const t = e.target; if (t && t.matches && t.matches('input[data-lista]')) comboAbrir(t); });
document.addEventListener('focusout', e => { if (e.target === comboAtual) setTimeout(() => { if (document.activeElement !== comboAtual) comboFechar(); }, 120); });
document.addEventListener('keydown', e => {
    const t = e.target; if (!t || !t.matches || !t.matches('input[data-lista]')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!comboAberto() || comboAtual !== t) comboAbrir(t, true); else comboMover(1); }
    else if (e.key === 'ArrowUp' && comboAberto()) { e.preventDefault(); comboMover(-1); }
    else if (e.key === 'Enter' && comboAberto()) {
        const box = comboElemento(); const it = box.querySelectorAll('.combo-item')[comboIdx];
        if (it && comboIdx >= 0) { e.preventDefault(); comboEscolher(t, decodeURIComponent(it.dataset.v)); } else comboFechar();
    }
    else if (e.key === 'Escape' && comboAberto()) { e.preventDefault(); e.stopPropagation(); comboFechar(); }
    else if (e.key === 'Tab') comboFechar();
}, true);
window.addEventListener('scroll', () => { if (comboAtual) comboPosicionar(); }, true);
window.addEventListener('resize', () => comboFechar());

/* ---------- Relatórios e listas ocupam toda a área disponível ---------- */
function ajustarAreaListas() {
    const m = document.querySelector('.main-content'); if (!m) return;
    const padInf = parseFloat(getComputedStyle(m).paddingBottom) || 0; const mTop = m.getBoundingClientRect().top;
    m.querySelectorAll('.table-container:not(.no-fill), .cascata-coluna > ul').forEach(el => {
        if (!el.offsetParent) return; // oculto
        const topo = el.getBoundingClientRect().top - mTop + m.scrollTop;
        let extra = padInf;
        for (let n = el; n && n !== m; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (n !== el) extra += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
            extra += parseFloat(cs.marginBottom) || 0;
            const nTopo = n.getBoundingClientRect().top;
            for (let s = n.nextElementSibling; s; s = s.nextElementSibling) {
                if (!s.offsetParent) continue;
                if (s.getBoundingClientRect().top <= nTopo + 1) continue; // ao lado, não abaixo
                const sc = getComputedStyle(s); extra += s.offsetHeight + (parseFloat(sc.marginTop) || 0) + (parseFloat(sc.marginBottom) || 0);
            }
        }
        const h = Math.max(240, Math.floor(m.clientHeight - topo - extra));
        el.style.height = h + 'px'; el.style.maxHeight = h + 'px';
    });
}

let _ajusteTimer = null;
function agendarAjusteArea() { clearTimeout(_ajusteTimer); _ajusteTimer = setTimeout(() => { try { ajustarAreaListas(); } catch (e) {} }, 40); }
window.addEventListener('resize', agendarAjusteArea);
document.addEventListener('DOMContentLoaded', () => {
    try { converterListasEmCombo(); } catch (e) {}
    const m = document.querySelector('.main-content');
    if (m && window.MutationObserver) new MutationObserver(agendarAjusteArea).observe(m, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    agendarAjusteArea();
});


/* =========================================================================
   13. RATEIO DA DESPESA EM ATÉ 4 TALHÕES
========================================================================= */
function rateioDe(t) {
    if (t && typeof t.rateio === 'string' && t.rateio.indexOf(':') > -1) {
        const l = t.rateio.split('|').map(s => { const i = s.lastIndexOf(':'); return { talhao: s.slice(0, i).trim().toUpperCase(), pct: parseFloat(s.slice(i + 1)) }; })
            .filter(x => x.talhao && x.talhao !== '-' && x.pct > 0);
        if (l.length >= 2) return l;
    }
    const t1 = strSafe(t && t.talhao).toUpperCase(), t2 = strSafe(t && t.talhao2).toUpperCase();
    if (t1 && t1 !== '-') {
        if (t2 && t2 !== '-') { let p = parseFloat(t.pct); if (isNaN(p) || p <= 0 || p >= 100) p = 50; return [{ talhao: t1, pct: p }, { talhao: t2, pct: Math.round((100 - p) * 100) / 100 }]; }
        return [{ talhao: t1, pct: 100 }];
    }
    return [];
}
function talhoesDe(t) { return rateioDe(t).map(x => x.talhao); }

const idRateio = (pref, n) => n === 1 ? pref + 'talhao' : pref + 'talhao' + n;
const idPct = (pref, n) => n === 1 ? pref + 'pct' : pref + 'pct' + n;

function htmlRateio(pref, lista) {
    let linhas = '';
    for (let n = 1; n <= 4; n++) {
        const it = (lista || [])[n - 1];
        linhas += `<div class="rateio-linha"><label>Talhão ${n}</label>
            <input type="text" id="${idRateio(pref, n)}" list="lista-talhoes" autocomplete="off" placeholder="${n === 1 ? 'Opcional' : 'Opcional'}" data-orig="${it ? strEscape(it.talhao) : ''}" value="${it ? strEscape(it.talhao) : ''}" oninput="atualizarSomaRateio('${pref}')" onchange="atualizarSomaRateio('${pref}')">
            <input type="number" id="${idPct(pref, n)}" class="rateio-pct" min="0.01" max="100" step="0.01" placeholder="%" title="Percentual deste talhão (vazio = divide o que sobrar)" value="${it && lista.length > 1 ? it.pct : ''}" oninput="atualizarSomaRateio('${pref}')"></div>`;
    }
    return `<div class="rateio-box"><div class="rateio-topo"><b>🌾 Talhões — distribuir o custo (até 4)</b>
        <span class="rateio-soma" id="${pref}rateio_soma"></span>
        <button type="button" class="btn-rateio" onclick="dividirIgual('${pref}')">⚖️ Dividir igualmente</button></div>
        <div class="rateio-grid">${linhas}</div></div>`;
}

function lerRateio(pref) {
    const itens = [];
    for (let n = 1; n <= 4; n++) {
        const nome = cadNorm(safeVal(idRateio(pref, n))); const raw = safeVal(idPct(pref, n)); const p = parseFloat(raw);
        if (nome) itens.push({ n: n, talhao: nome, pct: (raw !== '' && !isNaN(p)) ? p : null });
        else if (raw !== '' && n === 1) return { lista: [], erro: 'Informe o Talhão 1 antes de definir percentuais.' };
    }
    if (!itens.length) { return { lista: [] }; }
    const nomes = itens.map(i => i.talhao);
    if (new Set(nomes).size !== nomes.length) return { lista: [], erro: 'O mesmo talhão foi informado mais de uma vez.' };
    if (itens.length === 1) return { lista: [{ talhao: itens[0].talhao, pct: 100 }] };
    if (itens.some(i => i.pct !== null && (i.pct <= 0 || i.pct >= 100))) return { lista: [], erro: 'Cada percentual deve ficar entre 0 e 100.' };
    const dados = itens.filter(i => i.pct !== null); const brancos = itens.filter(i => i.pct === null);
    const soma = dados.reduce((s, i) => s + i.pct, 0);
    if (brancos.length) {
        const resto = Math.round((100 - soma) * 100) / 100;
        if (resto <= 0) return { lista: [], erro: `Os percentuais informados já somam ${soma}%. Não sobra nada para ${brancos.map(b => b.talhao).join(', ')}.` };
        let acc = 0; brancos.forEach((b, k) => { b.pct = (k === brancos.length - 1) ? Math.round((resto - acc) * 100) / 100 : Math.round(resto / brancos.length * 100) / 100; acc += b.pct; });
    } else if (Math.abs(soma - 100) > 0.01) {
        return { lista: [], erro: `A soma dos percentuais deve ser 100% (agora: ${Math.round(soma * 100) / 100}%).` };
    }
    return { lista: itens.map(i => ({ talhao: i.talhao, pct: i.pct })) };
}

function atualizarSomaRateio(pref) {
    const el = document.getElementById(pref + 'rateio_soma'); if (!el) return;
    const r = lerRateio(pref);
    if (r.erro) { el.textContent = r.erro; el.className = 'rateio-soma erro'; }
    else if (r.lista.length > 1) { el.textContent = r.lista.map(x => `${x.talhao} ${x.pct}%`).join(' · '); el.className = 'rateio-soma ok'; }
    else el.textContent = '';
}

function dividirIgual(pref) {
    const n = []; for (let i = 1; i <= 4; i++) if (cadNorm(safeVal(idRateio(pref, i)))) n.push(i);
    for (let i = 1; i <= 4; i++) setVal(idPct(pref, i), '');
    if (n.length > 1) { let acc = 0; n.forEach((i, k) => { const p = k === n.length - 1 ? Math.round((100 - acc) * 100) / 100 : Math.round(100 / n.length * 100) / 100; acc += p; setVal(idPct(pref, i), p); }); }
    atualizarSomaRateio(pref);
}

function gravarRateioNaTransacao(t, lista) {
    t.talhao = lista[0] ? lista[0].talhao : ''; t.talhao2 = lista[1] ? lista[1].talhao : '';
    t.pct = lista.length >= 2 ? lista[0].pct : 100;
    t.rateio = lista.length > 2 ? lista.map(x => x.talhao + ':' + x.pct).join('|') : '';
}

document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('d_rateio_box');
    if (box) { box.outerHTML = htmlRateio('d_', []).replace('class="rateio-box"', 'class="rateio-box" id="d_rateio_box" style="grid-column: 1 / -1;"'); try { vincularValidacaoCadastro(); } catch (e) {} }
});

/* =========================================================================
   14. CHUVAS: TOTAIS MENSAIS / ANUAIS E COMPARATIVO
========================================================================= */
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
let chartChuvaAnalise = null;

function chuvasValidas() { return chuvas.filter(c => c && !c.deleted && c.data && !isNaN(parseFloat(c.mm))).map(c => { const d = sanitizeDateString(c.data); return { ano: d.substring(0, 4), mes: parseInt(d.substring(5, 7), 10), dia: parseInt(d.substring(8, 10), 10), mm: parseFloat(c.mm) }; }); }

function abrirModalChuvas() {
    const l = chuvasValidas(); const anos = [...new Set(l.map(x => x.ano))].sort().reverse();
    const hoje = hojeLocal().substring(0, 4); const principal = anos.includes(hoje) ? hoje : (anos[0] || hoje);
    const opt = (lista, vazio) => (vazio ? `<option value="">${vazio}</option>` : '') + lista.map(a => `<option value="${a}">${a}</option>`).join('');
    const lista = anos.length ? anos : [hoje];
    document.getElementById('ca_ano_a').innerHTML = opt(lista); document.getElementById('ca_ano_b').innerHTML = opt(lista, 'SEM COMPARAÇÃO');
    setVal('ca_ano_a', principal); const outro = lista.find(a => a !== principal); setVal('ca_ano_b', outro || '');
    setVal('ca_visao', 'mensal'); setVal('ca_mes', '0');
    document.getElementById('modal-chuvas').style.display = 'flex'; renderAnaliseChuvas();
}
function fecharModalChuvas() { document.getElementById('modal-chuvas').style.display = 'none'; }

function renderAnaliseChuvas() {
    const visao = safeVal('ca_visao'); const mesF = parseInt(safeVal('ca_mes'), 10) || 0; const A = safeVal('ca_ano_a'); const B = safeVal('ca_ano_b');
    document.getElementById('ca_ano_a_box').style.display = visao === 'mensal' ? '' : 'none';
    document.getElementById('ca_ano_b_box').style.display = visao === 'mensal' ? '' : 'none';
    const l = chuvasValidas(); const fmt = n => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const pctTxt = (a, b) => b > 0 ? ((a - b) / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '-';
    const dif = (a, b) => { const d = a - b; return `<span style="color:${d > 0 ? '#2980b9' : d < 0 ? '#c0392b' : '#888'}; font-weight:700;">${d > 0 ? '+' : ''}${fmt(d)}</span>`; };
    let html = '', labels = [], datasets = [], resumo = '';
    if (visao === 'mensal') {
        const soma = ano => { const v = new Array(12).fill(0), dias = new Array(12).fill(0); l.filter(x => x.ano === ano).forEach(x => { v[x.mes - 1] += x.mm; if (x.mm > 0) dias[x.mes - 1]++; }); return { v, dias }; };
        const a = soma(A); const b = B ? soma(B) : null; const meses = mesF ? [mesF - 1] : [...Array(12).keys()];
        html = `<thead><tr><th>MÊS</th><th style="text-align:right">${A} (mm)</th><th style="text-align:right">DIAS COM CHUVA</th>${b ? `<th style="text-align:right">${B} (mm)</th><th style="text-align:right">DIAS</th><th style="text-align:right">DIFERENÇA (mm)</th><th style="text-align:right">VARIAÇÃO</th>` : ''}</tr></thead><tbody>`;
        let tA = 0, tB = 0, dA = 0, dB = 0;
        meses.forEach(i => {
            tA += a.v[i]; dA += a.dias[i]; labels.push(NOMES_MESES[i].substring(0, 3));
            html += `<tr><td><b>${NOMES_MESES[i]}</b></td><td style="text-align:right">${fmt(a.v[i])}</td><td style="text-align:right">${a.dias[i]}</td>`;
            if (b) { tB += b.v[i]; dB += b.dias[i]; html += `<td style="text-align:right">${fmt(b.v[i])}</td><td style="text-align:right">${b.dias[i]}</td><td style="text-align:right">${dif(a.v[i], b.v[i])}</td><td style="text-align:right">${pctTxt(a.v[i], b.v[i])}</td>`; }
            html += '</tr>';
        });
        html += `</tbody><tfoot><tr style="background:#f8f9fa; font-weight:700;"><td>TOTAL${mesF ? '' : ' DO ANO'}</td><td style="text-align:right">${fmt(tA)}</td><td style="text-align:right">${dA}</td>${b ? `<td style="text-align:right">${fmt(tB)}</td><td style="text-align:right">${dB}</td><td style="text-align:right">${dif(tA, tB)}</td><td style="text-align:right">${pctTxt(tA, tB)}</td>` : ''}</tr></tfoot>`;
        datasets.push({ label: A, data: meses.map(i => Math.round(a.v[i] * 10) / 10), backgroundColor: '#3498db' });
        if (b) datasets.push({ label: B, data: meses.map(i => Math.round(b.v[i] * 10) / 10), backgroundColor: '#e67e22' });
        resumo = `Total ${A}: <b>${fmt(tA)} mm</b>` + (b ? ` &nbsp;|&nbsp; Total ${B}: <b>${fmt(tB)} mm</b> &nbsp;|&nbsp; Diferença: ${dif(tA, tB)} mm (${pctTxt(tA, tB)})` : '');
    } else {
        const porAno = {}; l.filter(x => !mesF || x.mes === mesF).forEach(x => { const o = porAno[x.ano] || (porAno[x.ano] = { t: 0, dias: 0, max: 0 }); o.t += x.mm; if (x.mm > 0) o.dias++; if (x.mm > o.max) o.max = x.mm; });
        const anos = Object.keys(porAno).sort();
        html = `<thead><tr><th>ANO</th><th style="text-align:right">TOTAL (mm)</th><th style="text-align:right">DIAS COM CHUVA</th><th style="text-align:right">MÉDIA POR DIA CHUVOSO (mm)</th><th style="text-align:right">MAIOR CHUVA DIÁRIA (mm)</th><th style="text-align:right">VS. ANO ANTERIOR</th></tr></thead><tbody>`;
        anos.forEach((an, i) => { const o = porAno[an]; const ant = i > 0 ? porAno[anos[i - 1]] : null;
            html += `<tr><td><b>${an}</b></td><td style="text-align:right">${fmt(o.t)}</td><td style="text-align:right">${o.dias}</td><td style="text-align:right">${o.dias ? fmt(o.t / o.dias) : '-'}</td><td style="text-align:right">${fmt(o.max)}</td><td style="text-align:right">${ant ? dif(o.t, ant.t) + ' (' + pctTxt(o.t, ant.t) + ')' : '-'}</td></tr>`; });
        if (!anos.length) html += '<tr><td colspan="6" style="text-align:center; padding:25px; color:#aaa;">Sem registros no filtro escolhido</td></tr>';
        html += '</tbody>';
        labels = anos; datasets.push({ label: mesF ? `Total de ${NOMES_MESES[mesF - 1]} (mm)` : 'Total do ano (mm)', data: anos.map(a => Math.round(porAno[a].t * 10) / 10), backgroundColor: '#3498db' });
        const tot = anos.reduce((s, a) => s + porAno[a].t, 0); resumo = anos.length ? `Média anual${mesF ? ' (' + NOMES_MESES[mesF - 1] + ')' : ''}: <b>${fmt(tot / anos.length)} mm</b> em ${anos.length} ano(s)` : '';
    }
    document.getElementById('ca_tabela').innerHTML = html; document.getElementById('ca_resumo').innerHTML = resumo;
    if (typeof Chart === 'undefined') return;
    if (chartChuvaAnalise) chartChuvaAnalise.destroy();
    const m = visao === 'mensal' ? labels : labels;
    chartChuvaAnalise = new Chart(document.getElementById('chartChuvaAnalise').getContext('2d'), { type: 'bar', data: { labels: m, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Milímetros (mm)' } } } } });
}

/* =========================================================================
   15. MENU SUPERIOR
========================================================================= */
function fecharMenusTopo() { document.querySelectorAll('.menu-grupo.aberto').forEach(g => g.classList.remove('aberto')); }
function alternarGrupoMenu(ev, btn) { ev.stopPropagation(); const g = btn.parentElement; const aberto = g.classList.contains('aberto'); fecharMenusTopo(); if (!aberto) g.classList.add('aberto'); }
document.addEventListener('click', ev => { if (!(ev.target.closest && ev.target.closest('.menu-grupo'))) fecharMenusTopo(); });
function atualizarMarcasMenu() {
    document.querySelectorAll('.menu-grupo').forEach(g => {
        g.querySelector('.menu-grupo-btn').classList.toggle('btn-ativo', !!g.querySelector('.menu-sub button.btn-ativo'));
        let n = 0; g.querySelectorAll('.menu-sub .badge-atrasadas').forEach(b => { if (b.style.display !== 'none') n += parseInt(b.innerText, 10) || 0; });
        const bg = g.querySelector('.menu-grupo-btn .badge-atrasadas'); if (bg) { bg.innerText = n; bg.style.display = n > 0 ? 'inline-block' : 'none'; }
    });
    document.body.classList.toggle('na-home', !!document.getElementById('home') && document.getElementById('home').classList.contains('active'));
}


document.addEventListener('DOMContentLoaded', () => { try { atualizarMarcasMenu(); } catch (e) {} });

const VERSAO_SISTEMA = 'v28/10/2026-b';
document.addEventListener('DOMContentLoaded', () => { const v = document.getElementById('versao_sistema'); if (v) { v.textContent = VERSAO_SISTEMA; v.classList.add('ok'); } });

/* =========================================================================
   16. HIERARQUIA CATEGORIA → SETOR, UNIDADES E RENOMEAÇÃO DOS CADASTROS
========================================================================= */
const MARCA_ESTRUTURA = 'ESTRUTURA-2026-10-25';
let hierCat = '';

function cadChaves() { return CADASTROS_DEF.map(d => d.chave).concat(['vinculo', 'migracao', 'lavoura', 'orcamento', 'producao', 'cor', 'ativprod']); }
function vincKey(c, s) { return cadNorm(c) + '|' + cadNorm(s); }
function cadVinculado(c, s) { garantirOpcoes(); const e = opcoesDin.cad.vinculo[vincKey(c, s)]; return !!(e && !e.d); }
function setoresDe(c) { c = cadNorm(c); if (!c) return []; return cadLista('setor').filter(s => cadVinculado(c, s)); }
function categoriasDeSetor(s) { return cadLista('categoria_despesa').filter(c => cadVinculado(c, s)); }
function setorValidoParaCategoria(c, s) {
    c = cadNorm(c); s = cadNorm(s); if (!c || !s) return true;
    const l = setoresDe(c); return !l.length || l.includes(s);
}
function cadVincular(c, s) { garantirOpcoes(); opcoesDin.cad.vinculo[vincKey(c, s)] = { u: Date.now(), d: false }; }
function cadDesvincular(c, s) { garantirOpcoes(); opcoesDin.cad.vinculo[vincKey(c, s)] = { u: Date.now(), d: true }; }
function desvincularTodos(chave, nome) {
    garantirOpcoes(); const n = cadNorm(nome); const v = opcoesDin.cad.vinculo;
    Object.keys(v).forEach(k => {
        const i = k.indexOf('|'); const c = k.slice(0, i), s = k.slice(i + 1);
        if (((chave === 'categoria_despesa' && c === n) || (chave === 'setor' && s === n)) && v[k] && !v[k].d) v[k] = { u: Date.now(), d: true };
    });
}
function cadUsosPar(c, s) {
    c = cadNorm(c); s = cadNorm(s); let n = 0;
    transacoes.forEach(t => { if (t && !t.deleted && String(t.tipo).toLowerCase() !== 'receita' && cadNorm(t.categoria) === c && cadNorm(t.setor) === s) n++; });
    return n;
}

// Aplica uma única vez a estrutura padrão (categorias, setores e vínculos); itens antigos sem nenhum uso saem da lista
function migrarEstruturaDespesas() {
    garantirOpcoes(); if (opcoesDin.cad.migracao[MARCA_ESTRUTURA]) return false;
    const agora = Date.now(); const cad = opcoesDin.cad;
    Object.keys(ESTRUTURA_DESPESAS).forEach(c => {
        cad.categoria_despesa[c] = { u: agora, d: false };
        ESTRUTURA_DESPESAS[c].forEach(s => { cad.setor[s] = { u: agora, d: false }; cad.vinculo[vincKey(c, s)] = { u: agora, d: false }; });
    });
    const usoC = cadUsos('categoria_despesa'), usoS = cadUsos('setor'); const setPadrao = new Set(dSetoresPadrao);
    cadLista('categoria_despesa').forEach(n => { if (!ESTRUTURA_DESPESAS[n] && !usoC[n]) cad.categoria_despesa[n] = { u: agora, d: true }; });
    cadLista('setor').forEach(n => { if (!setPadrao.has(n) && !usoS[n]) cad.setor[n] = { u: agora, d: true }; });
    cad.migracao[MARCA_ESTRUTURA] = { u: agora, d: false };
    return true;
}

/* ---------- Renomear / unificar itens (propaga para os lançamentos) ---------- */
function cadRenomear(chave, de, para) {
    de = cadNorm(de); para = cadNorm(para); if (!de || !para || de === para) return -1;
    garantirOpcoes(); const agora = Date.now(); const cad = opcoesDin.cad; let alterados = 0;
    cad[chave][para] = { u: agora, d: false }; cad[chave][de] = { u: agora, d: true };
    if (chave === 'talhao') alterados += propagarTalhao(de, para, agora);
    if (chave === 'setor') moverSetorMapeamentos(de, para, agora);
    if (chave === 'setor' || chave === 'produto_receita') moverAtividades(chave, de, para, agora);
    if (chave === 'categoria_despesa' || chave === 'setor') {
        Object.keys(cad.vinculo).slice().forEach(k => {
            const e = cad.vinculo[k]; if (!e || e.d) return; const i = k.indexOf('|'); let c = k.slice(0, i), s = k.slice(i + 1);
            if (chave === 'categoria_despesa' && c === de) { cad.vinculo[k] = { u: agora, d: true }; cad.vinculo[vincKey(para, s)] = { u: agora, d: false }; }
            if (chave === 'setor' && s === de) { cad.vinculo[k] = { u: agora, d: true }; cad.vinculo[vincKey(c, para)] = { u: agora, d: false }; }
        });
    }
    transacoes.forEach(t => {
        if (!t || t.deleted) return; const rec = String(t.tipo).toLowerCase() === 'receita'; let mudou = false;
        if (chave === 'categoria_despesa' && !rec && cadNorm(t.categoria) === de) { t.categoria = para; mudou = true; }
        else if (chave === 'setor' && !rec && cadNorm(t.setor) === de) { t.setor = para; mudou = true; }
        else if (chave === 'fornecedor' && !rec && cadNorm(t.local) === de) { t.local = para; mudou = true; }
        else if (chave === 'produto_receita' && rec && cadNorm(t.categoria) === de) { t.categoria = para; mudou = true; }
        else if (chave === 'cliente' && rec && cadNorm(t.local) === de) { t.local = para; mudou = true; }
        else if (chave === 'unidade' && cadNorm(t.und) === de) { t.und = para; mudou = true; }
        if (mudou) { t.updatedAt = agora; alterados++; }
    });
    return alterados;
}

function atualizarTelasAposCadastro() {
    try { CADASTROS_DEF.forEach(d => renderListaCadastro(d.chave)); renderHierarquia(); } catch (e) {}
    try { atualizarListasAposCadastro(); atualizarOpcoesFiltros(); aplicarFiltros(); } catch (e) {}
    try { renderTalhoes(); renderDatalistsAgri(); popularSeletorSafraApp(); } catch (e) {}
}

function cadRenomearItem(chave, enc) {
    const de = decodeURIComponent(enc); const def = CADASTROS_DEF.find(d => d.chave === chave);
    const entrada = prompt(`Novo nome para ${def.titulo.toLowerCase()} "${de}":`, de); if (entrada === null) return;
    const para = cadNorm(entrada); if (!para || para === de) return;
    const usos = cadUsos(chave)[de] || 0; const existe = cadTem(chave, para);
    if ((usos || existe) && !confirm(`Renomear "${de}" para "${para}"?\n\n` + (usos ? `${usos} lançamento(s) serão atualizados.\n` : '') + (existe ? `"${para}" já existe: os dois serão unificados.` : ''))) return;
    const n = cadRenomear(chave, de, para);
    if (hierCat === de) hierCat = para;
    salvarDados(); atualizarTelasAposCadastro();
    mostrarToast(`${def.titulo} renomeado${n > 0 ? ' (' + n + ' lançamento(s) atualizados)' : ''}!`);
}

/* ---------- Tela de cadastros: categorias e setores em hierarquia ---------- */
function htmlHierarquia() {
    return `<div class="widget-box cad-card cad-hier" id="cad_hier" style="border-top: 4px solid var(--cor-laranja-flat);">
        <div class="widget-header" style="border:none; margin-bottom:8px; padding-bottom:0;"><span>🏷️ Categorias e Setores <small style="font-weight:600; text-transform:none; color:#888;">— cada setor pertence a uma categoria</small></span><span class="cad-contagem" id="hier_cont"></span></div>
        <div class="hier-grid">
            <div class="hier-col">
                <div class="hier-titulo">1. Categorias</div>
                <form class="cad-form" onsubmit="hierAddCategoria(event)"><input type="text" id="hier_in_cat" placeholder="Nova categoria" autocomplete="off"><button type="submit" class="btn-salvar-compacto" style="background: var(--cor-laranja-flat);">Adicionar</button></form>
                <ul class="cad-lista hier-lista" id="hier_lista_cat"></ul>
            </div>
            <div class="hier-col">
                <div class="hier-titulo" id="hier_titulo_set">2. Setores</div>
                <form class="cad-form" onsubmit="hierAddSetor(event)"><input type="text" id="hier_in_set" placeholder="Novo setor desta categoria" autocomplete="off"><button type="submit" class="btn-salvar-compacto" style="background: var(--cor-laranja-flat);">Adicionar</button></form>
                <div class="cad-form"><select id="hier_sel_existente"></select><button type="button" class="btn-salvar-compacto" style="background: var(--cor-azul-flat);" onclick="hierVincularExistente()">Vincular</button></div>
                <ul class="cad-lista hier-lista" id="hier_lista_set"></ul>
            </div>
        </div>
        <div id="hier_orfaos"></div>
        <div id="hier_lav"></div>
        <div id="hier_ativ"></div>
    </div>`;
}

function renderHierarquia() {
    const box = document.getElementById('cad_hier'); if (!box) return;
    const cats = cadLista('categoria_despesa');
    if (!cats.includes(hierCat)) hierCat = cats[0] || '';
    const usosC = cadUsos('categoria_despesa'); const termo = cadNorm(safeVal('hier_in_cat'));
    const catsVis = termo ? cats.filter(c => c.includes(termo)) : cats;
    let h = '';
    if (termo && !cats.includes(termo)) h += `<li class="cad-dica">➕ Clique em <b>Adicionar</b> para cadastrar “${strEscape(termo)}”</li>`;
    h += catsVis.map(c => `<li class="cad-item hier-cat${c === hierCat ? ' sel' : ''}" onclick="hierSelecionar('${encAttr(c)}')"><span class="cad-nome">${strEscape(c)}</span><span class="cad-uso">${setoresDe(c).length} setor(es) · ${usosC[c] ? usosC[c] + ' uso(s)' : 'sem uso'}</span>
        <button type="button" class="btn-acao btn-editar" title="Renomear" onclick="event.stopPropagation(); cadRenomearItem('categoria_despesa', '${encAttr(c)}')">✏️</button>
        <button type="button" class="btn-acao btn-excluir" title="Remover do cadastro" onclick="event.stopPropagation(); cadRemoverItem('categoria_despesa', '${encAttr(c)}')">🗑️</button></li>`).join('');
    document.getElementById('hier_lista_cat').innerHTML = h || '<li class="cad-dica">Nenhuma categoria cadastrada</li>';

    const tit = document.getElementById('hier_titulo_set'); const lista = setoresDe(hierCat);
    tit.innerHTML = hierCat ? `2. Setores de <b>${strEscape(hierCat)}</b>` : '2. Setores';
    const usosS = cadUsos('setor');
    document.getElementById('hier_lista_set').innerHTML = !hierCat ? '<li class="cad-dica">Cadastre ou selecione uma categoria</li>' :
        (lista.map(s => { const outras = categoriasDeSetor(s).filter(c => c !== hierCat);
            return `<li class="cad-item"><span class="cad-nome">${strEscape(s)}${talhaoDoSetor(s) ? ` <small class="hier-badge-lav" title="Setor ligado a este talhão">🌾 ${strEscape(talhaoDoSetor(s))}</small>` : ''}${outras.length ? ` <small class="cad-uso" title="Também vinculado a: ${strEscape(outras.join(', '))}">+${outras.length} categoria(s)</small>` : ''}</span><span class="cad-uso">${cadUsosPar(hierCat, s) ? cadUsosPar(hierCat, s) + ' uso(s)' : 'sem uso'}</span>
            <button type="button" class="btn-acao btn-editar" title="Renomear o setor (vale para todas as categorias)" onclick="cadRenomearItem('setor', '${encAttr(s)}')">✏️</button>
            <button type="button" class="btn-acao btn-excluir" title="Desvincular desta categoria" onclick="hierDesvincular('${encAttr(s)}')">✂️</button></li>`; }).join('') || '<li class="cad-dica">Nenhum setor vinculado — adicione abaixo ou vincule um existente</li>');
    const livres = cadLista('setor').filter(s => !cadVinculado(hierCat, s));
    document.getElementById('hier_sel_existente').innerHTML = '<option value="">Vincular setor já cadastrado…</option>' + livres.map(s => `<option value="${strEscape(s)}">${strEscape(s)}</option>`).join('');
    const orf = cadLista('setor').filter(s => !categoriasDeSetor(s).length);
    document.getElementById('hier_orfaos').innerHTML = orf.length ? `<div class="hier-orfaos"><b>Setores sem categoria (${orf.length}):</b> ` + orf.map(s => `<span class="hier-chip">${strEscape(s)} <a href="#" title="Remover do cadastro" onclick="cadRemoverItem('setor', '${encAttr(s)}'); return false;">✕</a></span>`).join('') + ` <small>— use “Vincular setor já cadastrado” para ligá-los a uma categoria.</small></div>` : '';
    const c = document.getElementById('hier_cont'); if (c) c.innerText = cats.length + ' categorias';
    renderLavourasSetores(); renderAtividadesCadastro();
}

function hierSelecionar(enc) { hierCat = decodeURIComponent(enc); renderHierarquia(); }
function hierAddCategoria(e) {
    e.preventDefault(); const n = cadNorm(safeVal('hier_in_cat')); if (!n) return;
    if (cadTem('categoria_despesa', n)) { hierCat = n; setVal('hier_in_cat', ''); renderHierarquia(); mostrarToast('Categoria já cadastrada!'); return; }
    cadAdicionar('categoria_despesa', n); hierCat = n; salvarDados(); setVal('hier_in_cat', ''); atualizarTelasAposCadastro(); mostrarToast('Categoria cadastrada! Agora adicione os setores dela.');
    focarPrimeiroCampo('hier_in_set');
}
function hierAddSetor(e) {
    e.preventDefault(); if (!hierCat) { mostrarToast('Escolha uma categoria primeiro'); return; }
    const n = cadNorm(safeVal('hier_in_set')); if (!n) return;
    if (cadVinculado(hierCat, n)) { mostrarToast('Esse setor já pertence a esta categoria!'); return; }
    if (!cadTem('setor', n)) cadAdicionar('setor', n);
    cadVincular(hierCat, n); salvarDados(); setVal('hier_in_set', ''); atualizarTelasAposCadastro(); mostrarToast('Setor cadastrado em ' + hierCat); focarPrimeiroCampo('hier_in_set');
}
function hierVincularExistente() {
    const s = cadNorm(safeVal('hier_sel_existente')); if (!hierCat || !s) return;
    cadVincular(hierCat, s); salvarDados(); atualizarTelasAposCadastro(); mostrarToast(s + ' vinculado a ' + hierCat);
}
function hierDesvincular(enc) {
    const s = decodeURIComponent(enc); const usos = cadUsosPar(hierCat, s);
    if (!confirm(`Desvincular "${s}" da categoria "${hierCat}"?\n\n` + (usos ? `${usos} lançamento(s) já usam essa combinação e NÃO serão alterados. ` : '') + `O setor deixa de ser oferecido para esta categoria.`)) return;
    cadDesvincular(hierCat, s); salvarDados(); atualizarTelasAposCadastro();
}

/* ---------- Lançamento: o setor depende da categoria escolhida ---------- */
function atualizarSetoresDaCategoria(pref) {
    const cat = cadNorm(safeVal(pref + 'categoria')); const dl = document.getElementById(pref === 'd_' ? 'lista_d_setor' : 'lista_ed_setor'); if (!dl) return;
    let lista = []; if (cat) { lista = setoresDe(cat); if (!lista.length) lista = cadLista('setor'); }
    dl.innerHTML = lista.map(v => `<option value="${strEscape(v)}">`).join('');
    const el = document.getElementById(pref + 'setor'); if (!el) return;
    el.placeholder = cat ? 'Selecione' : 'Escolha a categoria';
    if (pref === 'd_') {
        if (cat && cadNorm(el.value) && !lista.includes(cadNorm(el.value))) el.value = '';
        validarCampoCad('d_setor', 'setor');
    }
}
function atualizarAvisoInsumo() {
    const el = document.getElementById('d_aviso_insumo'); if (!el) return; const msgs = []; const insumo = categoriasInsumo.includes(cadNorm(safeVal('d_categoria')));
    if (insumo) msgs.push('💡 <b>Compra de insumo:</b> o custo só chega à lavoura quando o produto for <b>aplicado</b> (tela Aplicações). Dê entrada no estoque ao gravar e deixe o talhão em branco — assim a adubação não é contada duas vezes.');
    const m = talhaoDoSetor(safeVal('d_setor'));
    if (m && !insumo) msgs.push(`🌾 O setor <b>${strEscape(cadNorm(safeVal('d_setor')))}</b> é a lavoura <b>${strEscape(m)}</b>: o custo será atribuído a esse talhão automaticamente.`);
    el.innerHTML = msgs.join('<br>'); el.style.display = msgs.length ? 'block' : 'none';
}
function aoMudarCategoria(pref) { atualizarSetoresDaCategoria(pref); if (pref === 'd_') atualizarAvisoInsumo(); }

/* =========================================================================
   17. GESTÃO DE DESPESAS: POR SETOR, POR LAVOURA (TALHÃO) E POR SAFRA
   Regras:
   - Lavoura = talhão. Um setor pode estar ligado a um talhão (CAFÉ 1 = CAFÉ 01): o custo vai para ele.
   - Setores sem talhão são custos gerais (FAZENDA, TRATOR, ENERGIA, RAÇÃO...), exibidos à parte.
   - Adubos e defensivos comprados para o estoque só viram custo da lavoura quando APLICADOS.
   - Custeio e investimento são sempre exibidos separados.
========================================================================= */
const GRUPOS_CUSTO = ['ADUBAÇÃO', 'DEFENSIVOS', 'MÃO DE OBRA', 'COMBUSTÍVEL', 'ENERGIA', 'MANUTENÇÃO', 'OUTROS'];
const MARCA_LAVOURA = 'LAVOURA-2026-10-25';
let custosUltimo = null;
let gdCelulas = [];

function grupoCusto(texto) {
    const t = semAcento(texto);
    if (/ADUB|FERTIL|CALC|FOLIAR|NPK/.test(t)) return 'ADUBAÇÃO';
    if (/DEFENS|FUNGIC|HERBIC|INSETIC|ACARIC|BACTERIC|NEMAT|FORMIC/.test(t)) return 'DEFENSIVOS';
    if (/MAO DE OBRA|DIARIA|SALARIO|FUNCIONARIO/.test(t)) return 'MÃO DE OBRA';
    if (/COMBUST|DIESEL|GASOLINA/.test(t)) return 'COMBUSTÍVEL';
    if (/ENERGIA/.test(t)) return 'ENERGIA';
    if (/MANUT/.test(t)) return 'MANUTENÇÃO';
    return 'OUTROS';
}

/* ---------- Setor <-> talhão (lavoura) ---------- */
function talhaoDoSetor(s) {
    s = cadNorm(s); if (!s) return ''; garantirOpcoes();
    const l = opcoesDin.cad.lavoura; let u = -1, r = '';
    Object.keys(l).forEach(k => { const e = l[k]; if (!e || e.d) return; const i = k.indexOf('|'); if (k.slice(0, i) === s && (e.u || 0) >= u) { u = e.u || 0; r = k.slice(i + 1); } });
    return (r && cadTem('talhao', r)) ? r : '';
}
function setorDoTalhao(t) {
    t = cadNorm(t); if (!t) return ''; garantirOpcoes(); const l = opcoesDin.cad.lavoura; const achados = [];
    Object.keys(l).forEach(k => { const e = l[k]; if (!e || e.d) return; const i = k.indexOf('|'); const s = k.slice(0, i); if (k.slice(i + 1) === t && talhaoDoSetor(s) === t) achados.push(s); });
    achados.sort(); return achados[0] || '';
}
function cadMapearLavoura(setor, talhao) {
    garantirOpcoes(); const s = cadNorm(setor), t = cadNorm(talhao); const agora = Date.now(); const l = opcoesDin.cad.lavoura;
    Object.keys(l).forEach(k => { const e = l[k]; if (e && !e.d && k.slice(0, k.indexOf('|')) === s) l[k] = { u: agora, d: true }; });
    if (t) l[s + '|' + t] = { u: agora, d: false };
}
function conflitoSetorTalhao(setor, talhoes) {
    const m = talhaoDoSetor(setor); if (!m || !talhoes || !talhoes.length) return '';
    return talhoes.some(x => cadNorm(x) !== m) ? `O setor "${cadNorm(setor)}" corresponde ao talhão "${m}".\n\nDeixe o talhão em branco (o custo é atribuído automaticamente) ou escolha o mesmo talhão.` : '';
}
function moverSetorMapeamentos(de, para, agora) {
    const l = opcoesDin.cad.lavoura; Object.keys(l).slice().forEach(k => { const e = l[k]; if (!e || e.d) return; const i = k.indexOf('|'); if (k.slice(0, i) === de) { l[k] = { u: agora, d: true }; l[para + '|' + k.slice(i + 1)] = { u: agora, d: false }; } });
    const o = opcoesDin.cad.orcamento; Object.keys(o).slice().forEach(k => { const e = o[k]; if (!e || e.d) return; const p = k.split('|'); if (p.length === 3 && p[1] === de) { o[k] = { u: agora, d: true }; o[p[0] + '|' + para + '|' + p[2]] = { u: agora, d: false }; } });
}
// Renomeia um talhão em TODOS os registros (lançamentos, aplicações, análises, informações e vínculos com setores)
function propagarTalhao(de, para, agora) {
    let n = 0; const info = opcoesDin.talhoesInfo; const i = info[de];
    if (i && !i.deleted && !(info[para] && !info[para].deleted)) info[para] = Object.assign({}, i, { updatedAt: agora, deleted: false });
    if (i) info[de] = { deleted: true, updatedAt: agora };
    transacoes.forEach(t => {
        if (!t || t.deleted) return; const r = rateioDe(t);
        if (r.some(x => x.talhao === de)) { gravarRateioNaTransacao(t, r.map(x => ({ talhao: x.talhao === de ? para : x.talhao, pct: x.pct }))); t.updatedAt = agora; n++; }
    });
    agriRecords.forEach(r => { if (r && !r.deleted && cadNorm(r.talhao) === de) { r.talhao = para; r.updatedAt = agora; n++; } });
    analisesSolo.forEach(a => { if (a && !a.deleted && cadNorm(a.talhao) === de) { a.talhao = para; a.updatedAt = agora; n++; } });
    const l = opcoesDin.cad.lavoura; Object.keys(l).slice().forEach(k => { const e = l[k]; if (!e || e.d) return; const x = k.indexOf('|'); if (k.slice(x + 1) === de) { l[k] = { u: agora, d: true }; l[k.slice(0, x) + '|' + para] = { u: agora, d: false }; } });
    const pr = opcoesDin.cad.producao; Object.keys(pr).slice().forEach(k => { const e = pr[k]; if (!e || e.d) return; const p = k.split('|'); if (p.length === 3 && p[1] === de) { pr[k] = { u: agora, d: true }; pr[p[0] + '|' + para + '|' + p[2]] = { u: agora, d: false }; } });
    const co = opcoesDin.cad.cor; Object.keys(co).slice().forEach(k => { const e = co[k]; if (!e || e.d) return; const i2 = k.indexOf('|'); if (k.slice(0, i2) === de) { co[k] = { u: agora, d: true }; co[para + '|' + k.slice(i2 + 1)] = { u: agora, d: false }; } });
    sincronizarTalhoesDerivados();
    return n;
}

// Uma única vez: talhões passam a se chamar CAFÉ 01/02/03 e os setores CAFÉ 1/2/3 e MARACUJÁ são ligados a eles
function migrarLavouras() {
    garantirOpcoes(); if (opcoesDin.cad.migracao[MARCA_LAVOURA]) return false;
    const agora = Date.now();
    [['CAFÉ 2019', 'CAFÉ 01'], ['CAFÉ 2022', 'CAFÉ 02'], ['CAFÉ 2025', 'CAFÉ 03']].forEach(p => cadRenomear('talhao', p[0], p[1]));
    ['CAFÉ 01', 'CAFÉ 02', 'CAFÉ 03'].forEach(n => {
        if (!cadTem('talhao', n)) cadAdicionar('talhao', n);
        if (!infoTalhao(n)) opcoesDin.talhoesInfo[n] = { cultura: 'conilon', area: 0, plantas: 0, updatedAt: agora, deleted: false };
    });
    [['CAFÉ 1', 'CAFÉ 01'], ['CAFÉ 2', 'CAFÉ 02'], ['CAFÉ 3', 'CAFÉ 03']].forEach(p => { if (!talhaoDoSetor(p[0])) opcoesDin.cad.lavoura[p[0] + '|' + p[1]] = { u: agora, d: false }; });
    const mar = cadLista('talhao').filter(n => semAcento(n).indexOf('MARACUJA') === 0);
    if (mar.length === 1 && !talhaoDoSetor('MARACUJÁ')) opcoesDin.cad.lavoura['MARACUJÁ|' + mar[0]] = { u: agora, d: false };
    opcoesDin.cad.migracao[MARCA_LAVOURA] = { u: agora, d: false };
    return true;
}

/* ---------- Cadastros: ligação setor -> talhão ---------- */
function renderLavourasSetores() {
    const box = document.getElementById('hier_lav'); if (!box) return;
    const tal = cadLista('talhao');
    box.innerHTML = `<div class="hier-lav"><div class="hier-titulo">🌾 Setor ↔ Lavoura (talhão)</div>
        <div class="cad-dica" style="padding:0 0 10px;">Setores ligados a um talhão têm o custo atribuído a ele automaticamente. Setores sem talhão são <b>custos gerais</b> e aparecem à parte nos relatórios.</div>
        <div class="hier-lav-grid">` + cadLista('setor').map(s => { const m = talhaoDoSetor(s);
            return `<label class="hier-lav-item${m ? ' ligado' : ''}"><span>${strEscape(s)}</span><select onchange="hierMapearLavoura('${encAttr(s)}', this.value)"><option value="">Custo geral</option>${tal.map(t => `<option value="${strEscape(t)}"${t === m ? ' selected' : ''}>${strEscape(t)}</option>`).join('')}</select></label>`; }).join('') + '</div></div>';
}
function hierMapearLavoura(enc, valor) {
    const s = decodeURIComponent(enc); cadMapearLavoura(s, valor); salvarDados(); renderLavourasSetores();
    mostrarToast(valor ? `${s} ligado ao talhão ${valor}` : `${s} agora é custo geral`);
}

/* ---------- Orçamento por safra e setor ---------- */
function orcPrefixo(safra, setor) { return safra + '|' + setor + '|'; }
function orcGet(safra, setor) {
    garantirOpcoes(); const p = orcPrefixo(safra, cadNorm(setor)); let u = -1, v = 0;
    Object.keys(opcoesDin.cad.orcamento).forEach(k => { const e = opcoesDin.cad.orcamento[k]; if (k.indexOf(p) === 0 && e && !e.d && (e.u || 0) >= u) { u = e.u || 0; v = parseFloat(k.slice(p.length)) || 0; } });
    return v;
}
function orcSet(safra, setor, valor) {
    garantirOpcoes(); const p = orcPrefixo(safra, cadNorm(setor)); const agora = Date.now(); const o = opcoesDin.cad.orcamento;
    Object.keys(o).forEach(k => { if (k.indexOf(p) === 0 && o[k] && !o[k].d) o[k] = { u: agora, d: true }; });
    valor = Math.round((parseFloat(valor) || 0) * 100) / 100; if (valor > 0) o[p + valor] = { u: agora, d: false };
}
function safraOrcamento() { const s = safeVal('cs_safra'); return (s && s !== 'TODAS') ? s : obterSafraAtual(); }
function setoresOrdenados() {
    const l = cadLista('setor'); return l.filter(s => talhaoDoSetor(s)).concat(l.filter(s => !talhaoDoSetor(s)));
}
function abrirOrcamento() {
    const sf = safraOrcamento(); if (!sf || sf === 'Sem Data') { alert('Escolha uma safra.'); return; }
    const real = {}; custosAtomos().forEach(a => { if (a.safra === sf && a.nat === 'CUSTEIO') real[a.setor] = (real[a.setor] || 0) + a.valor; });
    document.getElementById('orc_titulo').innerText = '🎯 ORÇAMENTO DE CUSTEIO — SAFRA ' + sf;
    document.getElementById('orc_corpo').innerHTML = '<thead><tr><th>SETOR</th><th>LIGADO AO TALHÃO</th><th style="text-align:right">REALIZADO</th><th style="text-align:right">ORÇADO (R$)</th></tr></thead><tbody>' +
        setoresOrdenados().map(s => { const o = orcGet(sf, s); return `<tr><td><b>${strEscape(s)}</b></td><td>${strEscape(talhaoDoSetor(s) || 'Custo geral')}</td><td style="text-align:right">${formatarMoeda(real[s] || 0)}</td><td style="text-align:right"><input type="number" min="0" step="0.01" class="orc-in" data-setor="${encAttr(s)}" value="${o > 0 ? o : ''}" placeholder="0,00"></td></tr>`; }).join('') + '</tbody>';
    document.getElementById('modal-orcamento').dataset.safra = sf; document.getElementById('modal-orcamento').style.display = 'flex';
}
function fecharModalOrcamento() { document.getElementById('modal-orcamento').style.display = 'none'; }
function salvarOrcamento() {
    const m = document.getElementById('modal-orcamento'); const sf = m.dataset.safra; if (!sf) return;
    m.querySelectorAll('.orc-in').forEach(i => { const s = decodeURIComponent(i.dataset.setor); const novo = parseFloat(i.value) || 0; if (novo !== orcGet(sf, s)) orcSet(sf, s, novo); });
    salvarDados(); fecharModalOrcamento(); renderGestaoDespesas(); mostrarToast('Orçamento salvo!');
}

/* ---------- Base de cálculo: cada "átomo" é um valor de custo com data, safra, categoria, setor e talhão ---------- */
function custosAtomos() {
    const out = [];
    agriRecords.forEach(r => {
        if (!r || r.deleted || r.status !== 'APLICADO' || !r.talhao || r.talhao === '-' || !r.data) return;
        const v = custoAplicacao(r); if (!v) return; const tal = cadNorm(r.talhao); const g = grupoCusto(r.tipo || r.produto); const data = sanitizeDateString(r.data);
        out.push({ origem: 'Aplicação', data: data, safra: obterSafraGeral(data), nat: 'CUSTEIO', cat: g === 'ADUBAÇÃO' ? 'ADUBO' : (g === 'DEFENSIVOS' ? 'DEFENSIVO' : (cadNorm(r.tipo) || 'OUTROS')),
            setor: setorDoTalhao(tal) || tal, talhao: tal, valor: v, desc: strSafe(r.produto) + (r.dosagem ? ' — ' + r.dosagem : '') });
    });
    transacoes.forEach(t => {
        if (!t || t.deleted || !t.data) return; const tp = String(t.tipo).toLowerCase(); if (tp === 'receita') return;
        if (t.est_mov) return; // compra que entrou no estoque: só vira custo quando aplicada
        const v = parseFloat(t.valor) || 0; if (!v) return; const data = sanitizeDateString(t.data);
        const setor = cadNorm(t.setor); const base = { origem: 'Caixa', data: data, safra: obterSafraGeral(data), nat: tp === 'investimento' ? 'INVESTIMENTO' : 'CUSTEIO', cat: cadNorm(t.categoria) || 'SEM CATEGORIA',
            setor: (!setor || setor === '-') ? 'NÃO INFORMADO' : setor, desc: [strSafe(t.local) === '-' ? '' : strSafe(t.local), strSafe(t.desc) === '-' ? '' : strSafe(t.desc)].filter(Boolean).join(' — ') };
        const al = alocacaoTalhao(t);
        if (al.length) al.forEach(a => out.push(Object.assign({}, base, { talhao: a.talhao, valor: a.valor })));
        else out.push(Object.assign({}, base, { talhao: '', valor: v }));
    });
    return out.filter(a => a.safra !== 'Sem Data');
}
function receitasPorTalhao(safra) {
    const m = {};
    transacoes.forEach(t => {
        if (!t || t.deleted || String(t.tipo).toLowerCase() !== 'receita' || !t.data) return;
        if (safra !== 'TODAS' && obterSafraGeral(t.data) !== safra) return;
        const tl = cadNorm(t.talhao); if (!tl || tl === '-') return; const o = m[tl] || (m[tl] = { valor: 0, sacas: 0 });
        o.valor += parseFloat(t.valor) || 0; if (cadNorm(t.und) === 'SC') o.sacas += parseFloat(t.qtd) || 0;
    });
    return m;
}
function safrasDosCustos() {
    const s = new Set(custosAtomos().map(a => a.safra)); s.add(obterSafraAtual()); s.delete('Sem Data');
    return Array.from(s).sort().reverse();
}
const somaV = l => l.reduce((s, a) => s + a.valor, 0);
const celula = (at, t, extra) => Object.assign({ v: somaV(at), at: at, t: t }, extra || {});

function popularCustosTalhaoSafra() {
    const sel = document.getElementById('cs_safra'); if (!sel) return; const atual = sel.value;
    const safras = safrasDosCustos();
    sel.innerHTML = '<option value="TODAS">TODAS AS SAFRAS</option>' + safras.map(s => `<option value="${s}">Safra ${s}</option>`).join('');
    const padrao = safras.includes(obterSafraAtual()) ? obterSafraAtual() : 'TODAS';
    sel.value = (atual && (atual === 'TODAS' || safras.includes(atual))) ? atual : padrao;
    renderGestaoDespesas();
}

/* ---------- Visões ---------- */
function gdLavouras(A, f) {
    const comRec = f.nat === 'CUSTEIO'; const rec = receitasPorTalhao(f.safra); const cadT = cadLista('talhao'); const nomes = new Set(cadT);
    A.forEach(a => { if (a.talhao) nomes.add(a.talhao); });
    const lista = Array.from(nomes).sort((a, b) => { const ca = cadT.includes(a), cb = cadT.includes(b); return ca === cb ? a.localeCompare(b, 'pt-BR') : (ca ? -1 : 1); });
    const cab = ['TALHÃO / LAVOURA'].concat(GRUPOS_CUSTO, ['TOTAL', 'ÁREA (ha)', 'R$/ha']); const moeda = [1, 2, 3, 4, 5, 6, 7, 8, 10], num = [9];
    if (comRec) { cab.push('RECEITA', 'RESULTADO', 'COLHIDO', 'UND', 'CUSTO/UND'); moeda.push(11, 12, 15); num.push(13); }
    const linhaDe = (rot, at, area, r, est, titulo) => {
        const c = [rot]; GRUPOS_CUSTO.forEach(g => c.push(celula(at.filter(a => grupoCusto(a.cat) === g), titulo + ' · ' + g)));
        const tot = somaV(at); c.push(celula(at, titulo, { zero: true })); c.push(area > 0 ? area : ''); c.push(area > 0 ? tot / area : '');
        if (comRec) { if (r) { c.push(r.valor, r.valor - tot, r.col > 0 ? r.col : '', r.col > 0 ? r.und : '', r.col > 0 && tot > 0 ? tot / r.col : ''); } else c.push('', '', '', '', ''); }
        return { c: c, est: est || '' };
    };
    const linhas = []; const dados = [];
    lista.forEach(n => {
        const i = infoTalhao(n); const area = i ? (parseFloat(i.area) || 0) : 0; const at = A.filter(a => a.talhao === n);
        const rot = cadT.includes(n) ? n : n + ' (setor)'; const rr = { valor: rec[n] ? rec[n].valor : 0, col: prodGet(f.safra, n), und: unidadeColheita(n) }; dados.push({ at: at, area: area, r: rr }); const ln = linhaDe(rot, at, area, rr, '', n); if (cadT.includes(n)) ln.tal = n; linhas.push(ln);
    });
    const atL = A.filter(a => a.talhao); const areaT = dados.reduce((s, d) => s + d.area, 0); const custoComArea = dados.reduce((s, d) => s + (d.area > 0 ? somaV(d.at) : 0), 0);
    const recT = dados.reduce((s, d) => { if (d.r) s.valor += d.r.valor; return s; }, { valor: 0, col: 0, und: '' });
    const sub = linhaDe('SUBTOTAL LAVOURAS', atL, 0, recT, 'sub', 'Lavouras'); sub.c[9] = areaT > 0 ? areaT : ''; sub.c[10] = areaT > 0 ? custoComArea / areaT : ''; linhas.push(sub);
    const atG = A.filter(a => !a.talhao); linhas.push(linhaDe('CUSTOS GERAIS (sem talhão)', atG, 0, null, '', 'Custos gerais'));
    linhas.push(linhaDe('TOTAL GERAL', A, 0, null, 'total', 'Total geral'));
    return { titulo: 'Custos por talhão (lavoura)', cab: cab, linhas: linhas, moeda: moeda, num: num, pct: [], texto: comRec ? [0, 14] : [0], vazio: !A.length && !lista.length,
        nota: 'Lavoura = talhão. Inclui as aplicações realizadas (pelo custo do estoque) e as despesas do Caixa atribuídas ao talhão — direto, por rateio ou pelo setor ligado a ele (ex.: CAFÉ 1 = CAFÉ 01). Custos gerais não pertencem a um talhão e ficam à parte.' };
}

function gdOrdemSetores(A, sf) {
    const set = new Set(A.map(a => a.setor)); cadLista('setor').forEach(s => { if (talhaoDoSetor(s) || (sf && orcGet(sf, s) > 0)) set.add(s); });
    const tot = {}; A.forEach(a => { tot[a.setor] = (tot[a.setor] || 0) + a.valor; });
    return Array.from(set).sort((a, b) => { const la = talhaoDoSetor(a) ? 0 : 1, lb = talhaoDoSetor(b) ? 0 : 1; return la !== lb ? la - lb : ((tot[b] || 0) - (tot[a] || 0)) || a.localeCompare(b, 'pt-BR'); });
}
function gdSetores(A, f) {
    const sf = (f.safra !== 'TODAS' && f.nat === 'CUSTEIO') ? f.safra : null; const setores = gdOrdemSetores(A, sf);
    const totCat = {}; A.forEach(a => { totCat[a.cat] = (totCat[a.cat] || 0) + a.valor; });
    const cats = Object.keys(totCat).sort((a, b) => totCat[b] - totCat[a]);
    const cab = ['SETOR', 'CLASSE'].concat(cats, ['TOTAL']); const nC = cats.length; const moeda = []; for (let i = 2; i <= nC + 2; i++) moeda.push(i); const pct = [];
    if (sf) { cab.push('ORÇADO', '% USADO'); moeda.push(nC + 3); pct.push(nC + 4); }
    const comOrc = new Set(sf ? setores.filter(s => orcGet(sf, s) > 0) : []); const realOrc = fn => somaV(A.filter(a => comOrc.has(a.setor) && fn(a)));
    const linhaDe = (rot, classe, at, est, titulo, orc, real) => {
        const c = [rot, classe]; cats.forEach(k => c.push(celula(at.filter(a => a.cat === k), titulo + ' · ' + k))); const tot = somaV(at); c.push(celula(at, titulo, { zero: true }));
        if (sf) { c.push(orc > 0 ? orc : ''); c.push(orc > 0 ? { v: Math.round(real / orc * 1000) / 10, cls: real > orc ? 'gd-estouro' : '', zero: true } : ''); }
        return { c: c, est: est || '' };
    };
    const linhas = []; let orcL = 0, orcG = 0;
    setores.forEach(s => { const m = talhaoDoSetor(s); const orc = sf ? orcGet(sf, s) : 0; if (m) orcL += orc; else orcG += orc; const atS = A.filter(a => a.setor === s); linhas.push(linhaDe(s, m ? '🌾 ' + m : 'Geral', atS, '', s, orc, somaV(atS))); });
    const isL = a => !!talhaoDoSetor(a.setor);
    linhas.push(linhaDe('TOTAL LAVOURAS', '', A.filter(isL), 'sub', 'Lavouras', orcL, realOrc(isL)));
    linhas.push(linhaDe('TOTAL GERAIS', '', A.filter(a => !isL(a)), 'sub', 'Gerais', orcG, realOrc(a => !isL(a))));
    linhas.push(linhaDe('TOTAL', '', A, 'total', 'Total', orcL + orcG, realOrc(() => true)));
    return { titulo: 'Despesas por setor e categoria', cab: cab, linhas: linhas, moeda: moeda, num: [], pct: pct, texto: [0, 1], vazio: !A.length && !setores.length,
        nota: 'Cada linha é um setor (onde o dinheiro foi gasto); clique num valor para ver os lançamentos. ' + (sf ? 'Orçado e % usado referem-se ao custeio da safra ' + sf + ' (botão “Definir orçamento”).' : 'Escolha uma safra para acompanhar o orçamento.') };
}

function gdMensal(todos, f) {
    const sf = f.safra === 'TODAS' ? obterSafraAtual() : f.safra; const A = todos.filter(a => a.safra === sf && a.nat === f.nat);
    const y0 = 2000 + parseInt(sf.slice(0, 2), 10); const nomes = ['AGO', 'SET', 'OUT', 'NOV', 'DEZ', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL'];
    const meses = nomes.map((n, i) => { const m = i < 5 ? i + 8 : i - 4; const y = i < 5 ? y0 : y0 + 1; return { rot: n + '/' + String(y).slice(2), chave: y + '-' + String(m).padStart(2, '0') }; });
    const setores = gdOrdemSetores(A, null); const cab = ['SETOR', 'CLASSE'].concat(meses.map(m => m.rot), ['TOTAL']); const moeda = []; for (let i = 2; i <= 14; i++) moeda.push(i);
    const linhaDe = (rot, classe, at, est, titulo) => { const c = [rot, classe]; meses.forEach(m => c.push(celula(at.filter(a => a.data.indexOf(m.chave) === 0), titulo + ' · ' + m.rot))); c.push(celula(at, titulo, { zero: true })); return { c: c, est: est || '' }; };
    const linhas = setores.map(s => { const m = talhaoDoSetor(s); return linhaDe(s, m ? '🌾 ' + m : 'Geral', A.filter(a => a.setor === s), '', s); });
    const isL = a => !!talhaoDoSetor(a.setor);
    linhas.push(linhaDe('TOTAL LAVOURAS', '', A.filter(isL), 'sub', 'Lavouras')); linhas.push(linhaDe('TOTAL GERAIS', '', A.filter(a => !isL(a)), 'sub', 'Gerais')); linhas.push(linhaDe('TOTAL', '', A, 'total', 'Total'));
    return { titulo: 'Evolução mensal por setor', safraUsada: sf, cab: cab, linhas: linhas, moeda: moeda, num: [], pct: [], texto: [0, 1], vazio: !A.length && !setores.length,
        nota: 'Meses da safra ' + sf + ' (agosto a julho)' + (f.safra === 'TODAS' ? ' — escolha outra safra no filtro para mudar' : '') + '. Clique num valor para ver os lançamentos.' };
}

function gdGerais(A) {
    const G = A.filter(a => !a.talhao); const total = somaV(G); const porCat = {}; G.forEach(a => { (porCat[a.cat] || (porCat[a.cat] = [])).push(a); });
    const cats = Object.keys(porCat).sort((a, b) => somaV(porCat[b]) - somaV(porCat[a]));
    const cab = ['CATEGORIA', 'SETOR', 'TOTAL', '% DO GERAL']; const linhas = [];
    cats.forEach(c => {
        const porSet = {}; porCat[c].forEach(a => { (porSet[a.setor] || (porSet[a.setor] = [])).push(a); }); const sets = Object.keys(porSet).sort((a, b) => somaV(porSet[b]) - somaV(porSet[a]));
        sets.forEach(s => { const v = somaV(porSet[s]); linhas.push({ c: [c, s, celula(porSet[s], c + ' · ' + s), { v: total ? Math.round(v / total * 1000) / 10 : 0, zero: true }], est: '' }); });
        if (sets.length > 1) { const v = somaV(porCat[c]); linhas.push({ c: ['SUBTOTAL ' + c, '', celula(porCat[c], c), { v: total ? Math.round(v / total * 1000) / 10 : 0, zero: true }], est: 'sub' }); }
    });
    linhas.push({ c: ['TOTAL CUSTOS GERAIS', '', celula(G, 'Custos gerais', { zero: true }), { v: total ? 100 : 0, zero: true }], est: 'total' });
    return { titulo: 'Custos gerais por categoria e setor', cab: cab, linhas: linhas, moeda: [2], num: [], pct: [3], texto: [0, 1], vazio: !G.length,
        nota: 'Custos gerais: despesas que não pertencem a um talhão (FAZENDA, TRATOR, IRRIGAÇÃO, ENERGIA, RAÇÃO, FINANÇAS...). Veja o setor de cada categoria como cadastrado em Cadastros.' };
}

function gdComparativo(todos, f) {
    const A = todos.filter(a => a.nat === f.nat); const safras = Array.from(new Set(A.map(a => a.safra))).sort(); const cadT = cadLista('talhao'); const nomes = new Set(cadT); A.forEach(a => { if (a.talhao) nomes.add(a.talhao); });
    const lista = Array.from(nomes).sort((a, b) => { const ca = cadT.includes(a), cb = cadT.includes(b); return ca === cb ? a.localeCompare(b, 'pt-BR') : (ca ? -1 : 1); });
    const cab = ['TALHÃO / LAVOURA'].concat(safras.map(s => 'SAFRA ' + s), ['TOTAL', 'ÁREA (ha)']); const moeda = []; for (let i = 1; i <= safras.length + 1; i++) moeda.push(i);
    const linhaDe = (rot, at, area, est, titulo) => ({ c: [rot].concat(safras.map(s => celula(at.filter(a => a.safra === s), titulo + ' · safra ' + s)), [celula(at, titulo, { zero: true }), area > 0 ? area : '']), est: est || '' });
    const linhas = lista.map(n => { const i = infoTalhao(n); const ln = linhaDe(cadT.includes(n) ? n : n + ' (setor)', A.filter(a => a.talhao === n), i ? (parseFloat(i.area) || 0) : 0, '', n); if (cadT.includes(n)) ln.tal = n; return ln; });
    linhas.push(linhaDe('CUSTOS GERAIS (sem talhão)', A.filter(a => !a.talhao), 0, '', 'Custos gerais')); linhas.push(linhaDe('TOTAL GERAL', A, 0, 'total', 'Total geral'));
    return { titulo: 'Comparativo entre safras', cab: cab, linhas: linhas, moeda: moeda, num: [safras.length + 2], pct: [], texto: [0], vazio: !A.length,
        nota: 'Mesmo critério da visão por talhão, comparando as safras (agosto a julho).' };
}

/* ---------- Painel ---------- */
function renderCardsGestao(sel, f) {
    const c = sel.filter(a => a.nat === 'CUSTEIO'), inv = sel.filter(a => a.nat === 'INVESTIMENTO'); const cl = c.filter(a => a.talhao), cg = c.filter(a => !a.talhao);
    const card = (rot, v, sub, cor) => `<div class="gd-card" style="border-top-color:${cor};"><span>${rot}</span><b>${formatarMoeda(v)}</b><small>${sub}</small></div>`;
    let h = card('Custeio total', somaV(c), 'Gastos da safra, sem investimento', 'var(--cor-laranja-flat)') + card('Custeio das lavouras', somaV(cl), 'Atribuído a talhões', 'var(--cor-verde-flat)') + card('Custos gerais', somaV(cg), 'Sem talhão (fazenda, trator, ração…)', '#7f8c8d') + card('Investimento', somaV(inv), 'Separado do custeio', 'var(--cor-roxo-flat, #8e44ad)');
    if (f.safra !== 'TODAS') { const orcSet2 = cadLista('setor').filter(x => orcGet(f.safra, x) > 0); const orc = orcSet2.reduce((s, x) => s + orcGet(f.safra, x), 0); if (orc > 0) { const p = somaV(c.filter(a => orcSet2.includes(a.setor))) / orc * 100; h += card('Orçado (custeio)', orc, `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% usado nos setores orçados`, p > 100 ? 'var(--cor-vermelho-flat)' : 'var(--cor-azul-flat)'); } }
    const el = document.getElementById('gd_cards'); if (el) el.innerHTML = h;
}

function gdPlano(c) { return (c && typeof c === 'object') ? c.v : c; }
function gdHtml(sp) {
    const fmtV = (v, ci) => sp.pct.includes(ci) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : (sp.moeda.includes(ci) ? formatarMoeda(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
    const th = sp.cab.map((c, i) => `<th${sp.texto.includes(i) ? '' : ' style="text-align:right"'}>${strEscape(c)}</th>`).join('');
    const corpo = sp.linhas.map(l => '<tr' + (l.est ? ` class="gd-${l.est}"` : '') + (l.tal ? estiloLinhaTalhao(l.tal) : '') + '>' + l.c.map((c, ci) => {
        if (ci === 0 && l.tal && typeof c === 'string') return celTalhao(l.tal);
        const al = sp.texto.includes(ci) ? '' : ' style="text-align:right"'; let txt, cls = '';
        if (c && typeof c === 'object') {
            txt = (c.v === 0 && !c.zero) ? '-' : fmtV(c.v, ci); cls = c.cls || '';
            if (c.at && c.at.length) { gdCelulas.push({ t: c.t, at: c.at }); txt = `<a href="#" class="gd-clk" onclick="gdDetalhe(${gdCelulas.length - 1}); return false;">${txt}</a>`; }
        } else if (typeof c === 'number') txt = fmtV(c, ci); else txt = (c === '' || c === null || c === undefined) ? '-' : strEscape(c);
        return `<td${al}${cls ? ` class="${cls}"` : ''}>${txt}</td>`;
    }).join('') + '</tr>').join('');
    return `<thead><tr>${th}</tr></thead><tbody>${sp.vazio ? `<tr><td colspan="${sp.cab.length}" style="text-align:center; padding:30px; color:#aaa;">Sem despesas lançadas para esta seleção</td></tr>` : corpo}</tbody>`;
}

function renderGestaoDespesas() {
    const tab = document.getElementById('cs_tabela'); if (!tab) return;
    const f = { safra: safeVal('cs_safra') || 'TODAS', nat: safeVal('cs_nat') || 'CUSTEIO', visao: safeVal('cs_visao') || 'lavouras' };
    const todos = custosAtomos(); gdCelulas = []; const sel = todos.filter(a => f.safra === 'TODAS' || a.safra === f.safra); const A = sel.filter(a => a.nat === f.nat);
    renderCardsGestao(sel, f);
    const sp = f.visao === 'receitas' ? gdReceitas(todos, f) : f.visao === 'colheita' ? gdColheita(todos, f) : f.visao === 'setores' ? gdSetores(A, f) : f.visao === 'mensal' ? gdMensal(todos, f) : f.visao === 'gerais' ? gdGerais(A) : f.visao === 'comparativo' ? gdComparativo(todos, f) : gdLavouras(A, f);
    tab.innerHTML = gdHtml(sp);
    const natRot = f.nat === 'CUSTEIO' ? 'Custeio' : 'Investimento'; const safraRot = sp.safraUsada ? 'safra ' + sp.safraUsada : (f.visao === 'comparativo' || f.safra === 'TODAS' ? 'todas as safras' : 'safra ' + f.safra);
    const nota = document.getElementById('cs_nota');
    if (nota) nota.innerHTML = sp.nota + ' <b>Adubos e defensivos comprados para o estoque só entram no custo da lavoura quando são aplicados.</b>' + (f.nat === 'CUSTEIO' ? ' Investimento é mostrado à parte (troque o filtro “Natureza”).' : ' Você está vendo apenas investimentos; o custeio está no outro filtro.');
    const bo = document.getElementById('gd_btn_orc'); if (bo) bo.style.display = (f.visao === 'setores' || f.visao === 'mensal') ? '' : 'none';
    const bc = document.getElementById('gd_btn_col'); if (bc) bc.style.display = (f.visao === 'lavouras' || f.visao === 'colheita' || f.visao === 'receitas') ? '' : 'none';
    custosUltimo = { titulo: sp.titulo + ' — ' + natRot, subtitulo: 'Rancho 3C · ' + natRot + ' · ' + safraRot.charAt(0).toUpperCase() + safraRot.slice(1), cab: sp.cab, linhas: sp.linhas.map(l => l.c.map(gdPlano)), moeda: sp.moeda, num: sp.num.concat(sp.pct), totalRow: sp.linhas.length > 0 && !sp.vazio && !sp.semTotal, vazio: sp.vazio };
}

function gdDetalhe(i) {
    const d = gdCelulas[i]; if (!d) return; const at = d.at.slice().sort((a, b) => b.data.localeCompare(a.data) || b.valor - a.valor);
    document.getElementById('gd_titulo').innerText = '🔎 ' + d.t; const total = somaV(at);
    document.getElementById('gd_tabela').innerHTML = '<thead><tr><th>DATA</th><th>ORIGEM</th><th>CATEGORIA</th><th>SETOR</th><th>TALHÃO</th><th>DESCRIÇÃO</th><th style="text-align:right">VALOR</th></tr></thead><tbody>' +
        at.map(a => `<tr><td>${formatarData(a.data)}</td><td>${a.origem}</td><td>${strEscape(a.cat)}</td><td>${strEscape(a.setor)}</td><td>${strEscape(a.talhao || '-')}</td><td>${strEscape(a.desc || '-')}</td><td style="text-align:right">${formatarMoeda(a.valor)}</td></tr>`).join('') +
        `<tr class="gd-total"><td colspan="6">TOTAL — ${at.length} lançamento(s)</td><td style="text-align:right">${formatarMoeda(total)}</td></tr></tbody>`;
    document.getElementById('modal-gd').style.display = 'flex';
}
function fecharModalGd() { document.getElementById('modal-gd').style.display = 'none'; }

function exportarCustos(fmt) {
    if (!custosUltimo || custosUltimo.vazio) { alert('Não há despesas para exportar nesta seleção.'); return; }
    const c = custosUltimo; exportarTabela(fmt, 'despesas_rancho3c_' + hojeLocal(), c.titulo, c.subtitulo, c.cab, c.linhas, { moeda: c.moeda, num: c.num, totalRow: c.totalRow, planilha: 'Despesas' });
}

/* =========================================================================
   19. COLHEITA POR TALHÃO, RECEITA × CUSTO POR ATIVIDADE E CORES DOS TALHÕES
   - Colheita: café em SACAS (SC) e maracujá em KG, informada por talhão e por safra.
   - Atividade: lavouras agrupam-se pela cultura (CAFÉ, MARACUJÁ); os demais setores (GALINHAS, PEIXES...) são a própria atividade.
   - Cada receita pertence a uma atividade (pelo talhão ou pelo produto) para comparar receita × custo.
========================================================================= */
const PALETA_TALHOES = ['#cfe8ff', '#d4f5d4', '#ffe9b3', '#f5d0f0', '#ffd6cc', '#cdf2ee', '#e3dcff', '#fbe3c8', '#e0f0b8', '#ffd1e1', '#d9e2ec', '#f3e6c4'];
const MARCA_V9 = 'COLHEITA-COR-2026-10-28';

/* ---------- Cores dos talhões ---------- */
function corTalhao(n) {
    n = cadNorm(n); if (!n || n === '-') return '#eeeeee'; garantirOpcoes();
    const l = opcoesDin.cad.cor; let u = -1, r = '';
    Object.keys(l).forEach(k => { const e = l[k]; if (!e || e.d) return; const i = k.indexOf('|'); if (k.slice(0, i) === n && (e.u || 0) >= u) { u = e.u || 0; r = k.slice(i + 1); } });
    if (/^#[0-9a-fA-F]{6}$/.test(r)) return r;
    let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return PALETA_TALHOES[h % PALETA_TALHOES.length];
}
function temCorTalhao(n) { n = cadNorm(n); garantirOpcoes(); return Object.keys(opcoesDin.cad.cor).some(k => { const e = opcoesDin.cad.cor[k]; return e && !e.d && k.slice(0, k.indexOf('|')) === n; }); }
function setCorTalhao(n, hex) {
    garantirOpcoes(); n = cadNorm(n); const l = opcoesDin.cad.cor; const agora = Date.now();
    Object.keys(l).forEach(k => { const e = l[k]; if (e && !e.d && k.slice(0, k.indexOf('|')) === n) l[k] = { u: agora, d: true }; });
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) l[n + '|' + hex.toLowerCase()] = { u: agora, d: false };
}
function corLivreTalhao() {
    const usadas = new Set(cadLista('talhao').filter(temCorTalhao).map(n => corTalhao(n).toLowerCase()));
    return PALETA_TALHOES.find(c => !usadas.has(c)) || PALETA_TALHOES[usadas.size % PALETA_TALHOES.length];
}
// Mistura a cor do talhão com branco: t = parte de branco (0 = cor cheia, 1 = branco)
function clarear(hex, t) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); if (!m) return '#f4f4f4';
    const c = [m[1], m[2], m[3]].map(x => Math.round(parseInt(x, 16) + (255 - parseInt(x, 16)) * t)); return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
}
function chipTalhao(n) { n = cadNorm(n); if (!n || n === '-') return '-'; return `<span class="tal-chip" style="background:${clarear(corTalhao(n), 0.45)};">${strEscape(n)}</span>`; }
function celTalhao(n) { n = cadNorm(n); if (!n || n === '-') return '<td>-</td>'; return `<td class="tal-cel" style="background:${clarear(corTalhao(n), 0.45)};">${strEscape(n)}</td>`; }
function estiloLinhaTalhao(n) { n = cadNorm(n); return (!n || n === '-') ? '' : ` style="background:${clarear(corTalhao(n), 0.72)};"`; }

/* ---------- Colheita (quantidade colhida por talhão e safra) ---------- */
function culturaDoTalhao(n) {
    n = cadNorm(n); const i = infoTalhao(n); const c = i && i.cultura ? String(i.cultura).toLowerCase() : '';
    if (c === 'maracuja') return 'MARACUJÁ'; if (c === 'conilon') return 'CAFÉ';
    return semAcento(n).indexOf('MARACUJA') === 0 ? 'MARACUJÁ' : 'CAFÉ';
}
function unidadeColheita(n) { return culturaDoTalhao(n) === 'MARACUJÁ' ? 'KG' : 'SC'; }
function prodGet(safra, talhao) {
    garantirOpcoes(); talhao = cadNorm(talhao); const pr = opcoesDin.cad.producao; let soma = 0;
    if (safra === 'TODAS') { Object.keys(pr).forEach(k => { const e = pr[k]; if (!e || e.d) return; const p = k.split('|'); if (p.length === 3 && p[1] === talhao) soma += parseFloat(p[2]) || 0; }); return soma; }
    const pre = safra + '|' + talhao + '|'; let u = -1, v = 0;
    Object.keys(pr).forEach(k => { const e = pr[k]; if (k.indexOf(pre) === 0 && e && !e.d && (e.u || 0) >= u) { u = e.u || 0; v = parseFloat(k.slice(pre.length)) || 0; } });
    return v;
}
function prodSet(safra, talhao, valor) {
    garantirOpcoes(); talhao = cadNorm(talhao); const pre = safra + '|' + talhao + '|'; const agora = Date.now(); const pr = opcoesDin.cad.producao;
    Object.keys(pr).forEach(k => { if (k.indexOf(pre) === 0 && pr[k] && !pr[k].d) pr[k] = { u: agora, d: true }; });
    valor = Math.round((parseFloat(valor) || 0) * 100) / 100; if (valor > 0) pr[pre + valor] = { u: agora, d: false };
}
function safrasComColheita() { const s = new Set(); Object.keys(opcoesDin.cad.producao || {}).forEach(k => { const e = opcoesDin.cad.producao[k]; if (e && !e.d) s.add(k.split('|')[0]); }); return Array.from(s); }
function safraVizinha(sf, d) { const a = parseInt(String(sf).slice(0, 2), 10); if (isNaN(a)) return sf; const x = ((a + d) % 100 + 100) % 100; const y = (x + 1) % 100; return String(x).padStart(2, '0') + '/' + String(y).padStart(2, '0'); }
function renderColheitaLinhas() {
    const sf = safeVal('col_safra');
    document.getElementById('col_corpo').innerHTML = '<thead><tr><th>TALHÃO</th><th>CULTURA</th><th>UNIDADE</th><th style="text-align:right">QUANTIDADE COLHIDA</th></tr></thead><tbody>' +
        listaTodosTalhoes().map(n => { const u = unidadeColheita(n); const v = prodGet(sf, n);
            return `<tr>${celTalhao(n)}<td>${culturaDoTalhao(n)}</td><td>${u === 'SC' ? 'Sacas (SC)' : 'Quilos (KG)'}</td><td style="text-align:right"><input type="number" min="0" step="0.01" class="orc-in col-in" data-talhao="${encAttr(n)}" value="${v > 0 ? v : ''}" placeholder="0"> <b>${u}</b></td></tr>`; }).join('') + '</tbody>';
}
function abrirColheita(origem) {
    const sf0 = safeVal(origem === 'ind' ? 'ind_safra' : 'cs_safra'); const atual = obterSafraAtual(); const sf = (sf0 && sf0 !== 'TODAS') ? sf0 : atual;
    const set = new Set(safrasDosCustos().concat(safrasComColheita(), [safraVizinha(atual, -1), atual, safraVizinha(atual, 1)])); set.delete('Sem Data');
    const safras = Array.from(set).sort().reverse();
    document.getElementById('col_safra').innerHTML = safras.map(x => `<option value="${x}">Safra ${x}</option>`).join(''); document.getElementById('col_safra').value = sf;
    renderColheitaLinhas(); document.getElementById('modal-colheita').style.display = 'flex';
}
function fecharModalColheita() { document.getElementById('modal-colheita').style.display = 'none'; }
function salvarColheita() {
    const m = document.getElementById('modal-colheita'); const sf = safeVal('col_safra'); if (!sf) { alert('Escolha a safra da colheita.'); return; }
    m.querySelectorAll('.col-in').forEach(i => { const t = decodeURIComponent(i.dataset.talhao); const novo = parseFloat(i.value) || 0; if (Math.abs(novo - prodGet(sf, t)) > 0.0001) prodSet(sf, t, novo); });
    salvarDados(); fecharModalColheita(); try { renderGestaoDespesas(); } catch (e) {} try { renderIndicadoresTalhao(); } catch (e) {} mostrarToast('Colheita da safra ' + sf + ' salva!');
}

/* ---------- Atividades (receita × custo) ---------- */
function atividadeDoSetor(s) { s = cadNorm(s); const t = talhaoDoSetor(s); return t ? culturaDoTalhao(t) : s; }
function atividadeDoAtomo(a) { return (a.talhao && cadTem('talhao', a.talhao)) ? culturaDoTalhao(a.talhao) : atividadeDoSetor(a.setor); }
function atividadeDoProduto(p) {
    p = cadNorm(p); if (!p) return ''; garantirOpcoes(); const l = opcoesDin.cad.ativprod; let u = -1, r = '';
    Object.keys(l).forEach(k => { const e = l[k]; if (!e || e.d) return; const i = k.indexOf('|'); if (k.slice(0, i) === p && (e.u || 0) >= u) { u = e.u || 0; r = k.slice(i + 1); } });
    return r;
}
function cadMapearProduto(p, a) {
    garantirOpcoes(); p = cadNorm(p); a = cadNorm(a); const l = opcoesDin.cad.ativprod; const agora = Date.now();
    Object.keys(l).forEach(k => { const e = l[k]; if (e && !e.d && k.slice(0, k.indexOf('|')) === p) l[k] = { u: agora, d: true }; });
    if (a) l[p + '|' + a] = { u: agora, d: false };
}
function listaAtividades() {
    const s = new Set(); cadLista('talhao').forEach(t => s.add(culturaDoTalhao(t)));
    cadLista('setor').forEach(x => { if (!talhaoDoSetor(x)) s.add(x); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function moverAtividades(chave, de, para, agora) {
    const l = opcoesDin.cad.ativprod;
    Object.keys(l).slice().forEach(k => {
        const e = l[k]; if (!e || e.d) return; const i = k.indexOf('|'); const p = k.slice(0, i), a = k.slice(i + 1);
        if (chave === 'produto_receita' && p === de) { l[k] = { u: agora, d: true }; l[para + '|' + a] = { u: agora, d: false }; }
        if (chave === 'setor' && a === de) { l[k] = { u: agora, d: true }; l[p + '|' + para] = { u: agora, d: false }; }
    });
}
function migrarColheita() {
    garantirOpcoes(); if (opcoesDin.cad.migracao[MARCA_V9]) return false; const agora = Date.now();
    cadLista('talhao').forEach(n => { if (!temCorTalhao(n)) setCorTalhao(n, corLivreTalhao()); });
    cadLista('produto_receita').forEach(p => {
        if (atividadeDoProduto(p)) return; const t = semAcento(p); let a = '';
        if (t.indexOf('OVO') === 0 && cadTem('setor', 'GALINHAS')) a = 'GALINHAS'; else if (t.indexOf('MARACUJA') >= 0) a = 'MARACUJÁ'; else if (t.indexOf('CAFE') === 0) a = 'CAFÉ';
        if (a) opcoesDin.cad.ativprod[p + '|' + a] = { u: agora, d: false };
    });
    opcoesDin.cad.migracao[MARCA_V9] = { u: agora, d: false }; return true;
}
function receitasAtomos() {
    const out = [];
    transacoes.forEach(t => {
        if (!t || t.deleted || String(t.tipo).toLowerCase() !== 'receita' || !t.data) return; const v = parseFloat(t.valor) || 0; if (!v) return;
        const data = sanitizeDateString(t.data); const tal = cadNorm(t.talhao); const prod = cadNorm(t.categoria) || 'SEM PRODUTO';
        const ativ = (tal && tal !== '-' && cadTem('talhao', tal)) ? culturaDoTalhao(tal) : (atividadeDoProduto(prod) || 'SEM ATIVIDADE');
        const q = parseFloat(t.qtd); const und = cadNorm(t.und);
        out.push({ origem: 'Receita', data: data, safra: obterSafraGeral(data), nat: 'RECEITA', cat: prod, setor: ativ, talhao: (tal && tal !== '-') ? tal : '', valor: v, qtd: isNaN(q) ? 0 : q, und: und,
            desc: [strSafe(t.local) === '-' ? '' : strSafe(t.local), isNaN(q) ? '' : q + ' ' + und].filter(Boolean).join(' — ') });
    });
    return out.filter(a => a.safra !== 'Sem Data');
}

function renderAtividadesCadastro() {
    const box = document.getElementById('hier_ativ'); if (!box) return; const ativs = listaAtividades(); const tal = cadLista('talhao');
    box.innerHTML = `<div class="hier-lav"><div class="hier-titulo">📈 Produto de receita → Atividade</div>
        <div class="cad-dica" style="padding:0 0 10px;">Define a que atividade cada produto pertence para comparar <b>receita × custo</b> (ex.: OVOS → GALINHAS; CAFÉ SACA → CAFÉ). Receitas com talhão usam a cultura do talhão.</div>
        <div class="hier-lav-grid">` + cadLista('produto_receita').map(p => { const m = atividadeDoProduto(p);
            return `<label class="hier-lav-item${m ? ' ligado' : ''}"><span>${strEscape(p)}</span><select onchange="hierMapearProduto('${encAttr(p)}', this.value)"><option value="">Sem atividade</option>${ativs.map(a => `<option value="${strEscape(a)}"${a === m ? ' selected' : ''}>${strEscape(a)}</option>`).join('')}</select></label>`; }).join('') + `</div></div>
        <div class="hier-lav"><div class="hier-titulo">🎨 Cor de cada talhão</div>
        <div class="cad-dica" style="padding:0 0 10px;">A cor aparece como preenchimento do talhão em Aplicações, Caixa, Análises, Talhões e relatórios.</div>
        <div class="hier-lav-grid">` + tal.map(n => `<label class="hier-lav-item" style="background:${clarear(corTalhao(n), 0.45)};"><span>${strEscape(n)}</span><input type="color" value="${corTalhao(n)}" onchange="hierCorTalhao('${encAttr(n)}', this.value)"></label>`).join('') + '</div></div>';
}
function hierMapearProduto(enc, valor) { const p = decodeURIComponent(enc); cadMapearProduto(p, valor); salvarDados(); renderAtividadesCadastro(); mostrarToast(valor ? `${p} → ${valor}` : `${p} sem atividade`); }
function hierCorTalhao(enc, hex) {
    const n = decodeURIComponent(enc); setCorTalhao(n, hex); salvarDados(); renderAtividadesCadastro();
    try { renderTalhoes(); aplicarFiltros(); aplicarFiltroSafraApp(); renderGestaoDespesas(); } catch (e) {}
}

/* ---------- Relatórios novos ---------- */
function gdReceitas(todos, f) {
    const naSafra = a => f.safra === 'TODAS' || a.safra === f.safra; const C = todos.filter(a => naSafra(a) && a.nat === 'CUSTEIO'); const R = receitasAtomos().filter(naSafra);
    const cadT = cadLista('talhao'); const culturas = new Set(cadT.map(culturaDoTalhao)); const prodSet2 = new Set(R.map(r => r.setor));
    const ativs = new Set(); C.forEach(a => { const x = atividadeDoAtomo(a); if (culturas.has(x) || prodSet2.has(x)) ativs.add(x); }); R.forEach(r => ativs.add(r.setor)); culturas.forEach(c => ativs.add(c));
    const ordem = Array.from(ativs).filter(x => x !== 'SEM ATIVIDADE').sort((a, b) => { const ca = culturas.has(a) ? 0 : 1, cb = culturas.has(b) ? 0 : 1; return ca !== cb ? ca - cb : (somaV(R.filter(r => r.setor === b)) - somaV(R.filter(r => r.setor === a))); });
    if (ativs.has('SEM ATIVIDADE')) ordem.push('SEM ATIVIDADE');
    const cab = ['ATIVIDADE / PRODUTO', 'CUSTEIO', 'RECEITA', 'RESULTADO', 'MARGEM %', 'QTD', 'UND', 'PREÇO MÉDIO', 'CUSTO/UND']; const linhas = [];
    ordem.forEach(x => {
        const cx = x === 'SEM ATIVIDADE' ? [] : C.filter(a => atividadeDoAtomo(a) === x); const rx = R.filter(r => r.setor === x); const custo = somaV(cx), rec = somaV(rx);
        const ehCultura = culturas.has(x); let colhido = 0, und = '';
        if (ehCultura) { cadT.filter(t => culturaDoTalhao(t) === x).forEach(t => { colhido += prodGet(f.safra, t); und = unidadeColheita(t); }); }
        const rot = x === 'SEM ATIVIDADE' ? 'RECEITAS SEM ATIVIDADE (defina em Cadastros)' : x;
        linhas.push({ c: [rot, celula(cx, x + ' · custeio', { zero: true }), celula(rx, x + ' · receita', { zero: true }), { v: rec - custo, zero: true, cls: rec - custo < 0 ? 'gd-estouro' : '' }, rec > 0 ? { v: Math.round((rec - custo) / rec * 1000) / 10, zero: true, cls: rec - custo < 0 ? 'gd-estouro' : '' } : '',
            colhido > 0 ? colhido : '', colhido > 0 ? und + ' colhidas' : '', '', colhido > 0 && custo > 0 ? custo / colhido : ''], est: 'sub' });
        const porProd = {}; rx.forEach(r => { const k = r.cat + '|' + r.und; (porProd[k] || (porProd[k] = [])).push(r); });
        const chaves = Object.keys(porProd).sort((a, b) => somaV(porProd[b]) - somaV(porProd[a]));
        chaves.forEach(k => { const l = porProd[k]; const q = l.reduce((s, r) => s + r.qtd, 0), v = somaV(l);
            linhas.push({ c: ['· ' + l[0].cat, '', celula(l, x + ' · ' + l[0].cat), '', '', q > 0 ? q : '', l[0].und, q > 0 ? v / q : '', (!ehCultura && chaves.length === 1 && q > 0 && custo > 0) ? custo / q : ''], est: '' }); });
    });
    const ger = C.filter(a => { const x = atividadeDoAtomo(a); return !ordem.includes(x); });
    if (ger.length) linhas.push({ c: ['CUSTOS GERAIS (atividades sem receita)', celula(ger, 'Custos gerais', { zero: true }), '', { v: -somaV(ger), zero: true, cls: 'gd-estouro' }, '', '', '', '', ''], est: 'sub' });
    const totC = somaV(C), totR = somaV(R);
    linhas.push({ c: ['TOTAL', celula(C, 'Custeio total', { zero: true }), celula(R, 'Receita total', { zero: true }), { v: totR - totC, zero: true, cls: totR - totC < 0 ? 'gd-estouro' : '' }, totR > 0 ? { v: Math.round((totR - totC) / totR * 1000) / 10, zero: true } : '', '', '', '', ''], est: 'total' });
    return { titulo: 'Receita × custo por atividade', cab: cab, linhas: linhas, moeda: [1, 2, 3, 7, 8], num: [5], pct: [4], texto: [0, 6], vazio: !C.length && !R.length,
        nota: 'Compara o custeio com a receita de cada atividade: lavouras agrupadas pela cultura (CAFÉ, MARACUJÁ) e os demais setores (GALINHAS, PEIXES…). Nas linhas da lavoura, QTD é a quantidade <b>colhida</b> (botão “Informar colheita”) e CUSTO/UND é o custo de cada saca ou quilo colhido; nos produtos, QTD é a quantidade <b>vendida</b>. O investimento não entra.' };
}

function gdColheita(todos, f) {
    const R = receitasAtomos(); const A = todos.filter(a => a.nat === 'CUSTEIO' && a.talhao); const safras = new Set(A.map(a => a.safra)); R.forEach(r => safras.add(r.safra)); safrasComColheita().forEach(s => safras.add(s));
    const lista = Array.from(safras).filter(s => f.safra === 'TODAS' || s === f.safra).sort().reverse(); const cadT = cadLista('talhao'); const linhas = [];
    cadT.forEach(n => lista.forEach(sf => {
        const at = A.filter(a => a.talhao === n && a.safra === sf); const col = prodGet(sf, n); const rec = R.filter(r => r.talhao === n && r.safra === sf);
        if (!at.length && !col && !rec.length) return; const custo = somaV(at); const i = infoTalhao(n); const area = i ? (parseFloat(i.area) || 0) : 0; const u = unidadeColheita(n); const vr = somaV(rec);
        linhas.push({ c: [n, sf, celula(at, n + ' · safra ' + sf, { zero: true }), col > 0 ? col : '', col > 0 ? u : '', col > 0 && custo > 0 ? custo / col : '', area > 0 ? area : '', (area > 0 && col > 0) ? col / area : '', vr, vr - custo], est: '', tal: n });
    }));
    return { titulo: 'Custo por unidade colhida (por talhão e safra)', cab: ['TALHÃO', 'SAFRA', 'CUSTEIO', 'COLHIDO', 'UND', 'CUSTO/UND', 'ÁREA (ha)', 'PRODUT./HA', 'RECEITA', 'RESULTADO'], linhas: linhas, moeda: [2, 5, 8, 9], num: [3, 6, 7], pct: [], texto: [0, 1, 4], vazio: !linhas.length, semTotal: true,
        nota: 'Para cada talhão e safra: quanto foi gasto (custeio) e o custo de cada <b>saca</b> (café) ou <b>quilo</b> (maracujá) colhido. Informe a quantidade colhida no botão “Informar colheita”. Produtividade por hectare aparece quando a área do talhão está preenchida.' };
}


/* =========================================================================
   18. EXPORTAÇÃO EM EXCEL (.xlsx) E PDF — sem bibliotecas externas
========================================================================= */
function semControle(s) { return String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ''); }
function xmlEsc(s) { return semControle(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function colExcel(n) { let s = ''; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

const _tabelaCrc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = _tabelaCrc[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function zipArmazenar(arquivos) {
    const enc = new TextEncoder(); const partes = []; const central = []; let desloc = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255]; const u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    arquivos.forEach(f => {
        const nome = enc.encode(f.nome); const dados = enc.encode(f.conteudo); const crc = crc32(dados);
        const cab = [0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0)];
        partes.push(new Uint8Array(cab), nome, dados);
        central.push(new Uint8Array([0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(desloc)]), nome);
        desloc += cab.length + nome.length + dados.length;
    });
    let tamCentral = 0; central.forEach(p => { tamCentral += p.length; });
    const fim = new Uint8Array([0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamCentral), ...u32(desloc), ...u16(0)]);
    return new Blob(partes.concat(central, [fim]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function montarXlsx(titulo, subtitulo, cab, linhas, meta) {
    const moeda = new Set(meta.moeda || []), num = new Set(meta.num || []); const nCol = cab.length; const ultimaLinha = linhas.length;
    const larg = cab.map((c, i) => { let w = String(c).length; linhas.forEach(l => { const v = l[i]; const t = (typeof v === 'number') ? 16 : String(v === null || v === undefined ? '' : v).length; if (t > w) w = t; }); return Math.min(Math.max(w + 2, 10), 48); });
    let sd = '';
    sd += `<row r="1"><c r="A1" s="1" t="inlineStr"><is><t>${xmlEsc(titulo)}</t></is></c></row>`;
    sd += `<row r="2"><c r="A2" s="6" t="inlineStr"><is><t>${xmlEsc(subtitulo || '')}</t></is></c></row>`;
    sd += `<row r="3">` + cab.map((c, i) => `<c r="${colExcel(i)}3" s="2" t="inlineStr"><is><t>${xmlEsc(c)}</t></is></c>`).join('') + '</row>';
    linhas.forEach((l, ri) => {
        const r = ri + 4; const total = meta.totalRow && ri === linhas.length - 1;
        sd += `<row r="${r}">` + l.map((v, ci) => {
            const ref = colExcel(ci) + r;
            if (v === '' || v === null || v === undefined) return '';
            if (typeof v === 'number' && isFinite(v)) { const est = total ? (moeda.has(ci) ? 7 : 8) : (moeda.has(ci) ? 3 : (num.has(ci) ? 4 : 5)); return `<c r="${ref}" s="${est}"><v>${v}</v></c>`; }
            return `<c r="${ref}" s="${total ? 9 : 0}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
        }).join('') + '</row>';
    });
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>` +
        larg.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + `</cols><sheetData>${sd}</sheetData>` + (ultimaLinha ? `<autoFilter ref="A3:${colExcel(nCol - 1)}${ultimaLinha + 3}"/>` : '') + `</worksheet>`;
    const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>` +
        `<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF2F4A3A"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font></fonts>` +
        `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/><bgColor indexed="64"/></patternFill></fill></fills>` +
        `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
        `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
        `<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/></cellXfs>` +
        `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const nomePlan = xmlEsc((meta.planilha || 'Dados').replace(/[\[\]\*\?\/\\:]/g, ' ').substring(0, 31));
    return zipArmazenar([
        { nome: '[Content_Types].xml', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
        { nome: '_rels/.rels', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { nome: 'xl/workbook.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nomePlan}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
        { nome: 'xl/_rels/workbook.xml.rels', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
        { nome: 'xl/styles.xml', conteudo: estilos },
        { nome: 'xl/worksheets/sheet1.xml', conteudo: sheet }
    ]);
}

// Larguras (por mil) da fonte Helvetica para os caracteres ASCII 32 a 126
const HELV_W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
function pdfLimpar(s) {
    return semControle(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-').replace(/[•·]/g, '-')
        .replace(/[^ -~ -ÿ]/g, '').replace(/\s+/g, ' ').trim();
}
function pdfLargChar(ch) {
    const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) return HELV_W[c - 32];
    if (ch === 'º') return 365; if (ch === 'ª') return 370; if (ch === '²' || ch === '³') return 333;
    const base = ch.normalize('NFD').charCodeAt(0); return (base >= 32 && base <= 126) ? HELV_W[base - 32] : 556;
}
function pdfLarg(txt, tam, neg) { let w = 0; for (const ch of txt) w += pdfLargChar(ch); return w * tam / 1000 * (neg ? 1.07 : 1); }
function pdfTexto(s) {
    let o = ''; for (const ch of s) { const c = ch.charCodeAt(0); if (ch === '\\' || ch === '(' || ch === ')') o += '\\' + ch; else if (c < 32) o += ' '; else if (c < 127) o += ch; else o += '\\' + c.toString(8).padStart(3, '0'); }
    return o;
}
function pdfQuebrar(txt, larg, tam, maxLinhas, neg) {
    txt = pdfLimpar(txt); if (!txt) return ['']; const palavras = txt.split(' '); const linhas = []; let atual = '';
    const cabe = s => pdfLarg(s, tam, neg) <= larg;
    palavras.forEach(p => {
        let tentativa = atual ? atual + ' ' + p : p;
        if (cabe(tentativa)) { atual = tentativa; return; }
        if (atual) { linhas.push(atual); atual = ''; }
        while (!cabe(p) && p.length > 1) { let i = p.length - 1; while (i > 1 && !cabe(p.slice(0, i))) i--; linhas.push(p.slice(0, i)); p = p.slice(i); }
        atual = p;
    });
    if (atual) linhas.push(atual);
    if (linhas.length > maxLinhas) { const cort = linhas.slice(0, maxLinhas); let u = cort[maxLinhas - 1]; while (u.length > 1 && !cabe(u + '...')) u = u.slice(0, -1); cort[maxLinhas - 1] = u + '...'; return cort; }
    return linhas;
}

function montarPdf(titulo, subtitulo, cab, linhas, meta) {
    const moeda = new Set(meta.moeda || []), num = new Set(meta.num || []); const dir = i => moeda.has(i) || num.has(i);
    const fmt = (v, i) => { if (v === '' || v === null || v === undefined) return ''; if (typeof v === 'number') return moeda.has(i) ? formatarMoeda(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }); return String(v); };
    const paisagem = cab.length > 6; const PW = paisagem ? 842 : 595, PH = paisagem ? 595 : 842, M = 32, TAM = 7.5, LH = 10, PAD = 3;
    const disp = PW - 2 * M; const corpo = linhas.map(l => l.map((v, i) => pdfLimpar(fmt(v, i))));
    // larguras proporcionais ao conteúdo
    let pesos = cab.map((c, i) => { let w = pdfLarg(pdfLimpar(c), TAM, true); corpo.forEach(l => { const t = pdfLarg(l[i], TAM); if (t > w) w = t; }); return Math.min(Math.max(w + 2 * PAD + 2, 34), 230); });
    // cada coluna recebe ao menos a largura da sua maior palavra; o restante é dividido conforme o conteúdo
    const minimos = cab.map((c, i) => { let w = 0; const palavras = pdfLimpar(c).split(/\s+/).concat(...corpo.map(l => String(l[i]).split(/\s+/))); palavras.forEach(p => { const t = pdfLarg(p, TAM, true); if (t > w) w = t; }); return Math.min(pesos[i], w + 2 * PAD + 2); });
    const somaMin = minimos.reduce((s, v) => s + v, 0); let larguras;
    if (somaMin >= disp) { larguras = minimos.map(m => m * disp / somaMin); }
    else { const extra = pesos.map((p, i) => p - minimos[i]); const somaExtra = extra.reduce((s, v) => s + v, 0); const sobra = disp - somaMin; larguras = minimos.map((m, i) => m + (somaExtra > 0 ? sobra * extra[i] / somaExtra : sobra / cab.length)); }
    const paginas = []; let ops = []; let y = 0; const novaPagina = () => { ops = []; paginas.push(ops); y = PH - M; };
    const fy = v => v.toFixed(2);
    const texto = (x, yy, s, tam, neg, cor) => ops.push(`BT /${neg ? 'F2' : 'F1'} ${tam} Tf ${cor || '0 g'} ${fy(x)} ${fy(yy)} Td (${pdfTexto(s)}) Tj ET`);
    const retangulo = (x, yy, w, h, cor) => ops.push(`${cor} ${fy(x)} ${fy(yy)} ${fy(w)} ${fy(h)} re f`);
    const cabecalho = () => {
        const linhasCab = cab.map((c, i) => pdfQuebrar(c, larguras[i] - 2 * PAD, TAM, 2, true)); const altura = Math.max(...linhasCab.map(l => l.length)) * LH + 2 * PAD - 1;
        retangulo(M, y - altura, disp, altura, '0.85 0.92 0.83 rg'); let x = M;
        linhasCab.forEach((ls, i) => { ls.forEach((s, j) => { const w = pdfLarg(s, TAM, true); texto(dir(i) ? x + larguras[i] - PAD - w : x + PAD, y - PAD - TAM - j * LH + 1, s, TAM, true); }); x += larguras[i]; });
        y -= altura;
    };
    novaPagina();
    texto(M, y - 14, pdfLimpar(titulo), 14, true, '0.18 0.29 0.23 rg'); y -= 22;
    if (subtitulo) { texto(M, y - 9, pdfLimpar(subtitulo), 9, false, '0.4 g'); y -= 16; }
    y -= 4; cabecalho();
    corpo.forEach((cel, ri) => {
        const total = meta.totalRow && ri === corpo.length - 1;
        const quebradas = cel.map((s, i) => pdfQuebrar(s, larguras[i] - 2 * PAD, TAM, 3, total)); const altura = Math.max(...quebradas.map(l => l.length)) * LH + 2 * PAD - 1;
        if (y - altura < M + 22) { novaPagina(); cabecalho(); }
        if (total) { retangulo(M, y - altura, disp, altura, '0.94 g'); ops.push(`0.6 G 0.6 w ${fy(M)} ${fy(y)} m ${fy(M + disp)} ${fy(y)} l S`); }
        else if (ri % 2 === 1) retangulo(M, y - altura, disp, altura, '0.975 g');
        let x = M; quebradas.forEach((ls, i) => { ls.forEach((s, j) => { const w = pdfLarg(s, TAM, total); texto(dir(i) ? x + larguras[i] - PAD - w : x + PAD, y - PAD - TAM - j * LH + 1, s, TAM, total); }); x += larguras[i]; });
        y -= altura;
    });
    const agora = new Date(); const dt = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    paginas.forEach((p, i) => {
        ops = p; texto(M, 18, 'Rancho 3C - gerado em ' + dt, 7, false, '0.5 g'); const t = 'Página ' + (i + 1) + ' de ' + paginas.length; texto(PW - M - pdfLarg(t, 7), 18, t, 7, false, '0.5 g');
    });
    // monta o arquivo
    const objs = []; objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    const n = paginas.length; const kids = []; for (let i = 0; i < n; i++) kids.push((5 + i * 2) + ' 0 R');
    objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${n} >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    paginas.forEach((p, i) => {
        const cont = p.join('\n'); objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
        objs[6 + i * 2] = `<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`;
    });
    let out = '%PDF-1.4\n'; const pos = [];
    for (let i = 1; i < objs.length; i++) { pos[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xref = out.length; out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) out += String(pos[i]).padStart(10, '0') + ' 00000 n \n';
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info << /Title (${pdfTexto(pdfLimpar(titulo))}) /Producer (Rancho 3C) >> >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([out], { type: 'application/pdf' });
}

function baixarBlob(nome, blob) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
}

function exportarTabela(fmt, nomeBase, titulo, subtitulo, cab, linhas, meta) {
    meta = meta || {};
    try {
        if (fmt === 'xlsx') baixarBlob(nomeBase + '.xlsx', montarXlsx(titulo, subtitulo, cab, linhas, meta));
        else baixarBlob(nomeBase + '.pdf', montarPdf(titulo, subtitulo, cab, linhas, meta));
        mostrarToast('Arquivo ' + (fmt === 'xlsx' ? 'Excel (.xlsx)' : 'PDF') + ' gerado!');
    } catch (e) { alert('Não foi possível gerar o arquivo: ' + e.message); }
}

function exportarCaixa(fmt) {
    const lista = ultimaListaFiltrada || [];
    if (!lista.length) { alert('Nada para exportar com os filtros atuais.'); return; }
    const cab = ['Data', 'Tipo', 'Categoria / Produto', 'Setor', 'Talhão', 'Fornecedor / Cliente', 'Descrição', 'Qtd', 'Und', 'V. Unit', 'Total', 'Situação'];
    let rec = 0, sai = 0;
    const linhas = lista.map(t => {
        const rt = rateioDe(t); const tal = rt.map(x => rt.length > 1 ? `${x.talhao} (${x.pct}%)` : x.talhao).join(' / ');
        const v = parseFloat(t.valor) || 0; if (String(t.tipo).toLowerCase() === 'receita') rec += v; else sai += v;
        const q = parseFloat(t.qtd); const u = parseFloat(t.v_unit);
        return [formatarData(t.data), String(t.tipo).toUpperCase(), strSafe(t.categoria), strSafe(t.setor) === '-' ? '' : strSafe(t.setor), tal, strSafe(t.local) === '-' ? '' : strSafe(t.local), strSafe(t.desc) === '-' ? '' : strSafe(t.desc), isNaN(q) ? '' : q, strSafe(t.und), isNaN(u) ? '' : u, v, strSafe(t.sit)];
    });
    const sub = `${lista.length} lançamento(s) · Receitas ${formatarMoeda(rec)} · Saídas ${formatarMoeda(sai)} · Saldo ${formatarMoeda(rec - sai)}`;
    exportarTabela(fmt, 'caixa_rancho3c_' + hojeLocal(), 'Caixa Diário', sub, cab, linhas, { moeda: [9, 10], num: [7], planilha: 'Caixa Diário' });
}

function exportarRelatorioAgri(fmt) {
    const tb = document.getElementById('tbody_rel_agri'); if (!tb) return;
    const cab = Array.from(tb.closest('table').querySelectorAll('thead th')).map(th => th.innerText.trim());
    const linhas = []; let temTotal = false;
    Array.from(tb.querySelectorAll('tr')).forEach(tr => {
        const tds = Array.from(tr.children); if (tds.length === 1 && tds[0].colSpan > 1) return;
        const linha = []; tds.forEach(td => { for (let i = 1; i < (td.colSpan || 1); i++) linha.push(''); linha.push(td.innerText.trim()); });
        if (tds.length < cab.length) temTotal = true;
        while (linha.length < cab.length) linha.push('');
        linhas.push(linha);
    });
    if (!linhas.length) { alert('Gere o relatório antes de exportar.'); return; }
    const conv = linhas.map(l => l.map((v, i) => (i === cab.length - 1 && /^R\$\s/.test(v)) ? (parseFloat(v.replace(/[^\d,-]/g, '').replace(',', '.')) || 0) : v));
    const sub = Array.from(document.querySelectorAll('#rel_agri_cabecalho div')).map(d => d.innerText.replace(/\s+/g, ' ').trim()).join(' ');
    exportarTabela(fmt, 'aplicacoes_rancho3c_' + hojeLocal(), 'Relatório de Aplicações', sub, cab, conv, { moeda: [cab.length - 1], totalRow: temTotal, planilha: 'Aplicações' });
}


/* COMANDO GLOBAL PARA MAIÚSCULAS (só altera o valor quando necessário, para não fechar listas de sugestão) */
document.addEventListener('input', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        const tipo = e.target.type ? e.target.type.toLowerCase() : 'text';
        if (tipo === 'text' || tipo === 'search' || !e.target.hasAttribute('type')) {
            const atual = e.target.value; const maiusculo = atual.toUpperCase();
            if (atual === maiusculo) return;
            const start = e.target.selectionStart; const end = e.target.selectionEnd;
            e.target.value = maiusculo;
            try { if (start !== null && end !== null) e.target.setSelectionRange(start, end); } catch(err) {}
        }
    }
});

window.onload = () => { carregarDadosNuvem(); };
