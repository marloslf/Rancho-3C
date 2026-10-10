/* =========================================================================
   1. CONFIGURAÇÕES E ESTADO GERAL
========================================================================= */
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbx4Gc3P2B0Jh7_piAm9a-auSTSYrXDqsVS5FkXXjciddgzOhhlHISRTGo-PGuNpBgQD3w/exec";

const dCategoriasPadrao = ["ACARICIDA", "ADUBO", "ADUBO FOLIAR", "BACTERICIDA", "DIÁRIAS", "DIESEL", "FUNGICIDA", "GASOLINA", "HERBICIDA", "INSETICIDA", "INSUMOS", "INVESTIMENTO", "MANUTENÇÃO", "MERCADO", "PROLABORE", "RAÇÃO"];
const dSetoresPadrao = ["ADMINISTRAÇÃO", "CÃES", "CAFÉ", "CAFÉ 01", "CAFÉ 02", "CAFÉ 03", "CASA", "CAVALOS", "COLHEITA", "DEFINIR", "FAZENDA", "FUNCIONÁRIOS", "GADO", "GALINHAS", "IRRIGAÇÃO", "LAVOURAS", "MARACUJÁ", "PEDRO MARINELLI", "PEIXES", "TORREFAÇÃO", "TRATOR"];
const rCategoriasPadrao = ["ACEROLA - POLPA", "CAFÉ 250G", "CAFÉ 500G", "CAFÉ EM GRÃOS", "CAFÉ SACA", "CRÉDITO", "ESTACAS DE EUCALÍPTO", "GRAVIOLA - POLPA S/SEM.", "MARACUJÁ - FRUTO", "MARACUJÁ - POLPA C/SEM.", "MARACUJÁ - POLPA S/SEM.", "OVOS", "PASTO - ALUGUEL", "RENDIMENTOS"];
const unidadesReceita = { "ACEROLA - POLPA": "KG", "CAFÉ 250G": "PCT", "CAFÉ 500G": "PCT", "CAFÉ EM GRÃOS": "PCT", "CAFÉ SACA": "SC", "CRÉDITO": "R$", "ESTACAS DE EUCALÍPTO": "UN", "GRAVIOLA - POLPA S/SEM.": "KG", "MARACUJÁ - FRUTO": "KG", "MARACUJÁ - POLPA C/SEM.": "KG", "MARACUJÁ - POLPA S/SEM.": "KG", "OVOS": "DZ", "PASTO - ALUGUEL": "MÊS", "RENDIMENTOS": "R$" };

let transacoes = []; let agriRecords = []; let estoque = []; let chuvas = []; let analisesSolo = [];
let opcoesDin = { talhoes: ["CAFÉ 2019", "CAFÉ 2022"], tipos: [], formas: [], alvos: [] };
let colOrdenacao = 'data'; let ordemAscendente = false; let filtroRapido = '';
let chartCaixaObj = null, chartPendenteObj = null; let chartS_Agri = null, chartT_Agri = null, chartTp_Agri = null, chartCS_Agri = null, chartCT_Agri = null; let chartChuvasObj = null;
let permissaoNuvem = false; 

/* =========================================================================
   2. UTILITÁRIOS
========================================================================= */
function generateUUID() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
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
function setVal(id, valor) { const el = document.getElementById(id); if (el) { let old = el.value; el.innerHTML = valor; if(old && el.options) el.value = old; else el.value = valor; } }
function setHtml(id, htmlStr) { const el = document.getElementById(id); if (el) { let old = el.value; el.innerHTML = htmlStr; if(old) el.value = old; } }

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
                setVal('d_local', fornecedor);
                let prod = dets[0].getElementsByTagName("prod")[0];
                if (prod) {
                    setVal('d_descricao', (prod.getElementsByTagName("xProd")[0] ? prod.getElementsByTagName("xProd")[0].textContent : "").toUpperCase());
                    setVal('d_qtd', parseFloat(prod.getElementsByTagName("qCom")[0] ? prod.getElementsByTagName("qCom")[0].textContent : 0).toFixed(2));
                    setVal('d_v_unit', parseFloat(prod.getElementsByTagName("vUnCom")[0] ? prod.getElementsByTagName("vUnCom")[0].textContent : 0).toFixed(2));
                    setVal('d_und', (prod.getElementsByTagName("uCom")[0] ? prod.getElementsByTagName("uCom")[0].textContent : "UN").toUpperCase());
                    
                    let vProd = prod.getElementsByTagName("vProd")[0] ? parseFloat(prod.getElementsByTagName("vProd")[0].textContent) : 0;
                    setVal('d_valor', vProd.toFixed(2));
                }
                mostrarToast("Item carregado no formulário! Revise e grave.");
            } else {
                let tipoFinal = document.getElementById('d_natureza').value;
                let categoriaCat = document.getElementById('d_categoria').value.trim().toUpperCase() || "A CLASSIFICAR";
                let setorCat = document.getElementById('d_setor').value.trim().toUpperCase() || "-";

                for(let i = 0; i < dets.length; i++) {
                    let prod = dets[i].getElementsByTagName("prod")[0];
                    if(!prod) continue;
                    
                    let desc = (prod.getElementsByTagName("xProd")[0] ? prod.getElementsByTagName("xProd")[0].textContent : "ITEM SEM NOME").toUpperCase();
                    let qtd = parseFloat(prod.getElementsByTagName("qCom")[0] ? prod.getElementsByTagName("qCom")[0].textContent : 0);
                    let vUn = parseFloat(prod.getElementsByTagName("vUnCom")[0] ? prod.getElementsByTagName("vUnCom")[0].textContent : 0);
                    let vTot = parseFloat(prod.getElementsByTagName("vProd")[0] ? prod.getElementsByTagName("vProd")[0].textContent : 0);
                    let und = (prod.getElementsByTagName("uCom")[0] ? prod.getElementsByTagName("uCom")[0].textContent : "UN").toUpperCase();

                    transacoes.push({
                        id: generateUUID(), updatedAt: Date.now(), deleted: false,
                        data: dataNF, tipo: tipoFinal, categoria: categoriaCat,
                        setor: setorCat, local: fornecedor, desc: desc,
                        qtd: qtd, und: und, v_unit: vUn, valor: vTot, sit: 'A pagar', obs: 'Importação Automática XML'
                    });
                }
                salvarDados();
                preencherSelectsSafraFin(); atualizarOpcoesFiltros(); aplicarFiltros(); preencherSelectsLancamento();
                mostrarToast(`${dets.length} itens importados para a tabela!`);
            }
        } catch (error) {
            alert("Erro ao processar XML. Certifique-se de que é um arquivo de NF-e válido.");
        }
        event.target.value = '';
    }

/* =========================================================================
   4. SINCRONIZAÇÃO E ALGORITMO HASH
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
    statusDiv.innerHTML = '⏳ Saneando BD...'; statusDiv.className = 'status-conexao aguardando';
    
    try {
        const localStr = localStorage.getItem('rancho3c_offline');
        if (localStr) {
            const localData = JSON.parse(localStr);
            transacoes = localData.transacoes || []; agriRecords = localData.aplicacoes || [];
            estoque = Array.isArray(localData.estoque) ? localData.estoque : Object.values(localData.estoque || {});
            analisesSolo = localData.analises || []; opcoesDin = localData.opcoes || opcoesDin;
            chuvas = localData.chuvas || [];
        }
    } catch(e){}

    try {
        const response = await fetch(URL_GOOGLE_SCRIPT);
        if(!response.ok) throw new Error("HTTP Error");
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            transacoes = unificarDados(transacoes, data.transacoes, hashTransacao);
            agriRecords = unificarDados(agriRecords, data.aplicacoes, hashAgri);
            analisesSolo = unificarDados(analisesSolo, data.analises, hashSolo);
            estoque = unificarDados(estoque, Array.isArray(data.estoque) ? data.estoque : Object.values(data.estoque || {}), hashEstoque);
            chuvas = unificarDados(chuvas, data.chuvas, hashChuva);

            if(data.opcoes) {
                opcoesDin.talhoes = [...new Set([...opcoesDin.talhoes, ...(data.opcoes.talhoes || [])])].sort();
                opcoesDin.tipos = [...new Set([...opcoesDin.tipos, ...(data.opcoes.tipos || [])])].sort();
                opcoesDin.formas = [...new Set([...opcoesDin.formas, ...(data.opcoes.formas || [])])].sort();
                opcoesDin.alvos = [...new Set([...opcoesDin.alvos, ...(data.opcoes.alvos || [])])].sort();
            }
        }
        permissaoNuvem = true; 
        statusDiv.innerHTML = '🟢 DADOS SINCRONIZADOS E LIMPOS'; statusDiv.className = 'status-conexao conectado';
    } catch(e) {
        permissaoNuvem = false; 
        transacoes = unificarDados(transacoes, [], hashTransacao); agriRecords = unificarDados(agriRecords, [], hashAgri); analisesSolo = unificarDados(analisesSolo, [], hashSolo);
        estoque = unificarDados(estoque, [], hashEstoque); chuvas = unificarDados(chuvas, [], hashChuva);
        statusDiv.innerHTML = '🔴 MODO OFFLINE (Nuvem Segura)'; statusDiv.className = 'status-conexao erro';
    }

    const payload = { transacoes, aplicacoes: agriRecords, estoque, opcoes: opcoesDin, analises: analisesSolo, chuvas };
    try { localStorage.setItem('rancho3c_offline', JSON.stringify(payload)); } catch(err) {}

    try { preencherSelectsLancamento(); popularSeletorSolo(); preencherSelectsSafraFin(); renderDatalistsAgri(); popularSeletorSafraApp(); } catch(e){}
    if(permissaoNuvem) salvarDados();
    showTab('home');
}

async function salvarDados() {
    const statusDiv = document.getElementById('status_conexao');
    const payload = { transacoes, aplicacoes: agriRecords, estoque, opcoes: opcoesDin, analises: analisesSolo, chuvas };
    
    try { localStorage.setItem('rancho3c_offline', JSON.stringify(payload)); } catch(err) { mostrarToast("Erro local: Memória Cheia!"); }
    
    if (!permissaoNuvem) { statusDiv.innerHTML = '🔴 GUARDADO LOCAL'; statusDiv.className = 'status-conexao erro'; return; }

    statusDiv.innerHTML = '⏳ A gravar...'; statusDiv.className = 'status-conexao aguardando';
    try {
        const response = await fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        if(!response.ok) throw new Error("HTTP Error");
        statusDiv.innerHTML = `🟢 SINCRONIZADO`; statusDiv.className = 'status-conexao conectado'; 
    } catch (e) { 
        permissaoNuvem = false; statusDiv.innerHTML = '🔴 GUARDADO LOCAL'; statusDiv.className = 'status-conexao erro'; 
    }
}

function showTab(id) {
    try {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sidebar-menu button').forEach(b => b.classList.remove('btn-ativo'));
        document.getElementById(id).classList.add('active');
        const btnMap = { 'home': 'btn_home', 'resumo': 'btn_resumo', 'movimentacoes': 'btn_movimentacoes', 'relatorios_detalhados': 'btn_relatorios_detalhados', 'pendencias': 'btn_pendencias', 'agri_app': 'btn_agri_app', 'agri_est': 'btn_agri_est', 'agri_dash': 'btn_agri_dash', 'chuvas_main': 'btn_chuvas', 'solo_main': 'btn_solo' };
        if(btnMap[id]) document.getElementById(btnMap[id]).classList.add('btn-ativo');
        
        if(id === 'resumo') atualizarResumoEGrafico();
        if(id === 'relatorios_detalhados') { atualizarRelatoriosDetalhados(); renderCascataCategorias(); }
        if(id === 'movimentacoes') { atualizarOpcoesFiltros(); aplicarFiltros(); }
        if(id === 'pendencias') renderizarTabelasPendencias();
        if(id === 'agri_app') aplicarFiltroSafraApp();
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

    const badgeElement = document.getElementById('badge_atrasadas');
    if(qtdAtrasadas > 0 && badgeElement) { badgeElement.innerText = qtdAtrasadas; badgeElement.style.display = 'inline-block'; } else if (badgeElement) { badgeElement.style.display = 'none'; }
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
        hR += `<li class="item-lista-grafico"><div style="display:flex; justify-content:space-between;"><span>${strEscape(x[0])}</span> <span>${formatarMoeda(x[1])}</span></div><div class="barra-grafico-container"><div class="barra-grafico-receita" style="width: ${perc}%;"></div></div></li>`; 
    });
    document.getElementById('lista_top_receitas').innerHTML = hR || '<li class="item-lista-grafico" style="cursor:default;">Nenhuma receita paga</li>';

    let arrDCat = Object.entries(dCat).sort((a,b) => b[1] - a[1]).slice(0, 5); let maxDCat = arrDCat.length > 0 ? arrDCat[0][1] : 0; let hD = '';
    arrDCat.forEach(x => { 
        let perc = maxDCat > 0 ? (x[1] / maxDCat) * 100 : 0; let codeStr = encodeURIComponent(x[0]); 
        hD += `<li class="item-lista-grafico"><div style="display:flex; justify-content:space-between;"><span>${strEscape(x[0])}</span> <span>${formatarMoeda(x[1])}</span></div><div class="barra-grafico-container"><div class="barra-grafico-despesa" style="width: ${perc}%;"></div></div></li>`; 
    });
    document.getElementById('lista_top_despesas').innerHTML = hD || '<li class="item-lista-grafico" style="cursor:default;">Nenhuma saída paga</li>';
}

function atualizarFiltrosRelatorios() {
    atualizarRelatoriosDetalhados();
    if(document.getElementById('rel_view_cascata').classList.contains('active')) {
        renderCascataCategorias();
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
    document.getElementById('rel_view_tabelas').classList.remove('active');
    document.getElementById('rel_view_cascata').classList.remove('active');
    document.getElementById('btn_rel_tabelas').classList.remove('active');
    document.getElementById('btn_rel_cascata').classList.remove('active');
    
    document.getElementById('rel_view_' + mode).classList.add('active');
    document.getElementById('btn_rel_' + mode).classList.add('active');
    
    if(mode === 'cascata') renderCascataCategorias();
}

function renderCascataCategorias() {
    const filtroMes = safeVal('filtro_mes_relatorios'); const filtroSafra = safeVal('filtro_safra_relatorios');
    const tipoFiltro = safeVal('cascata_tipo'); 
    
    let agregadorCat = {}; let valorGeral = 0;

    transacoes.forEach(t => {
        if(t.deleted) return;
        let sit = strSafe(t.sit).toLowerCase(); if (!sit.includes('pago')) return;
        if (filtroSafra && obterSafraGeral(t.data) !== filtroSafra) return;
        if (filtroMes && (!t.data || !sanitizeDateString(t.data).startsWith(filtroMes))) return;

        let tipoStr = String(t.tipo).toLowerCase(); 
        if (tipoStr !== tipoFiltro.toLowerCase()) return;

        let cat = strSafe(t.categoria); if (!cat || cat === '-') cat = (tipoStr === 'receita') ? strSafe(t.desc) : strSafe(t.setor); 
        cat = cat.toUpperCase() || "SEM CATEGORIA";

        let v = parseFloat(t.valor) || 0;
        agregadorCat[cat] = (agregadorCat[cat] || 0) + v;
        valorGeral += v;
    });

    document.getElementById('cascata_total_geral').innerText = formatarMoeda(valorGeral);
    document.getElementById('lista_cascata_desc').innerHTML = '<li style="list-style:none; color:#aaa; font-style:italic;">Selecione uma categoria ao lado...</li>';

    let arrCat = Object.entries(agregadorCat).sort((a,b) => b[1] - a[1]);
    let htmlCat = ''; let maxCat = arrCat.length > 0 ? arrCat[0][1] : 0;
    let corBarra = tipoFiltro === 'Receita' ? 'barra-grafico-receita' : (tipoFiltro === 'Investimento' ? 'background-color: var(--cor-roxo-flat);' : 'barra-grafico-despesa');

    arrCat.forEach(x => {
        let perc = maxCat > 0 ? (x[1] / maxCat) * 100 : 0;
        let barraHTML = tipoFiltro === 'Investimento' 
            ? `<div class="barra-grafico-container"><div style="${corBarra} height: 100%; border-radius: 2px; width: ${perc}%;"></div></div>`
            : `<div class="barra-grafico-container"><div class="${corBarra}" style="width: ${perc}%;"></div></div>`;
        
        let codeStr = encodeURIComponent(x[0]);
        htmlCat += `<li class="item-lista-grafico" onclick="renderCascataDescricao('${codeStr}', '${tipoFiltro}')" style="padding:10px; background:#fff; border-radius:4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #eee;">
                <div style="display:flex; justify-content:space-between; font-weight:700; color:#444;"><span>${strEscape(x[0])}</span> <span>${formatarMoeda(x[1])}</span></div>
                ${barraHTML}</li>`;
    });

    document.getElementById('lista_cascata_cat').innerHTML = htmlCat || '<li style="list-style:none;">Nenhum dado encontrado para o filtro.</li>';
}

function renderCascataDescricao(catEncoded, tipoFiltro) {
    let categoriaAlvo = decodeURIComponent(catEncoded);
    const filtroMes = safeVal('filtro_mes_relatorios'); const filtroSafra = safeVal('filtro_safra_relatorios');
    
    let agregadorDesc = {}; 

    transacoes.forEach(t => {
        if(t.deleted) return;
        let sit = strSafe(t.sit).toLowerCase(); if (!sit.includes('pago')) return;
        if (filtroSafra && obterSafraGeral(t.data) !== filtroSafra) return;
        if (filtroMes && (!t.data || !sanitizeDateString(t.data).startsWith(filtroMes))) return;

        let tipoStr = String(t.tipo).toLowerCase(); 
        if (tipoStr !== tipoFiltro.toLowerCase()) return;

        let cat = strSafe(t.categoria); if (!cat || cat === '-') cat = (tipoStr === 'receita') ? strSafe(t.desc) : strSafe(t.setor); 
        cat = cat.toUpperCase() || "SEM CATEGORIA";

        if (cat === categoriaAlvo) {
            let v = parseFloat(t.valor) || 0;
            let chaveDesc = strSafe(t.desc).toUpperCase(); if (!chaveDesc || chaveDesc === '-') chaveDesc = "SEM DESCRIÇÃO";
            let loc = strSafe(t.local).toUpperCase();
            if(loc && loc !== '-') chaveDesc = `${chaveDesc} <br><span style="font-size:10px; color:#aaa; font-weight:normal;">📍 ${loc}</span>`;
            
            agregadorDesc[chaveDesc] = (agregadorDesc[chaveDesc] || 0) + v;
        }
    });

    let arrDesc = Object.entries(agregadorDesc).sort((a,b) => b[1] - a[1]);
    let htmlDesc = `<div style="font-size: 11px; text-transform: uppercase; color: #888; font-weight: 700; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 5px;">Detalhamento de: <span style="color:var(--cor-texto);">${strEscape(categoriaAlvo)}</span></div>`;
    
    arrDesc.forEach(x => {
        htmlDesc += `<li style="list-style: none; margin-bottom: 12px; border-bottom: 1px dashed #e0e0e0; padding-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; color: #555; align-items: center;">
                    <span style="font-weight: 600; max-width: 65%; line-height:1.4;">${x[0]}</span> <span style="font-weight: 700; color: #333;">${formatarMoeda(x[1])}</span>
                </div></li>`;
    });

    document.getElementById('lista_cascata_desc').innerHTML = htmlDesc || '<li>Nenhum detalhe disponível.</li>';
}

function mudarTemaSaida() {
    const select = document.getElementById('d_natureza'); const caixa = document.getElementById('caixa_lancamento_saida'); const titulo = document.getElementById('titulo_saida'); 
    if(select.value === 'Investimento') { caixa.className = 'linha-lancamento linha-investimento-ativa no-print'; titulo.style.color = 'var(--cor-roxo-flat)'; select.style.color = 'var(--cor-roxo-flat)';
    } else { caixa.className = 'linha-lancamento linha-despesa no-print'; titulo.style.color = 'var(--cor-laranja-flat)'; select.style.color = 'var(--cor-laranja-flat)'; }
}

function addTransacao(e, tipoBase) {
    e.preventDefault(); 
    try {
        const prefix = tipoBase === 'Saida' ? 'd_' : 'r_';
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

        transacoes.push({ id: generateUUID(), updatedAt: Date.now(), deleted: false, data: data, tipo: tipoFinal, categoria: cat, setor: setor, local: loc, desc: desc, qtd: qtd, und: und, v_unit: parseFloat(vUnit), valor: val, sit: document.getElementById(prefix + 'sit').value || 'Pago', obs: '' });
        salvarDados(); 
        
        if(tipoBase === 'Saida') document.getElementById('caixa_form_saida').reset();
        else document.getElementById('caixa_form_receita').reset();

        preencherSelectsSafraFin(); atualizarOpcoesFiltros(); aplicarFiltros(); preencherSelectsLancamento();
        mostrarToast(tipoFinal.toUpperCase() + ' GRAVADA!'); document.getElementById(prefix + 'data').focus();
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
    let dCats = new Set(dCategoriasPadrao); let dSets = new Set(dSetoresPadrao); let dLocais = new Set(), dDescs = new Set(); let rCats = new Set(rCategoriasPadrao); let rLocais = new Set();
    transacoes.forEach(t => {
        if(t.deleted) return;
        let tipoLower = String(t.tipo).toLowerCase();
        if (tipoLower === 'despesa' || tipoLower === 'investimento') {
            if (strSafe(t.categoria)) dCats.add(strSafe(t.categoria).toUpperCase());
            if (strSafe(t.setor)) dSets.add(strSafe(t.setor).toUpperCase());
            if (strSafe(t.local)) dLocais.add(strSafe(t.local).toUpperCase());
            if (strSafe(t.desc)) dDescs.add(strSafe(t.desc).toUpperCase());
        } else if(tipoLower === 'receita') {
            if (strSafe(t.categoria)) rCats.add(strSafe(t.categoria).toUpperCase());
            if (strSafe(t.local)) rLocais.add(strSafe(t.local).toUpperCase());
        }
    });
    function buildDatalist(id, setVals) { const dl = document.getElementById(id); if (dl) dl.innerHTML = Array.from(setVals).sort().map(v => `<option value="${strEscape(v)}">`).join(''); }
    buildDatalist('lista_d_categoria', dCats); buildDatalist('lista_d_setor', dSets); buildDatalist('lista_d_local', dLocais); buildDatalist('lista_d_descricao', dDescs);
    buildDatalist('lista_r_categoria', rCats); buildDatalist('lista_r_local', rLocais);
}

function calcularTotalReceita() { let q = parseFloat(document.getElementById('r_qtd').value) || 0; let v = parseFloat(document.getElementById('r_v_unit').value) || 0; if (q>0 && v>0) document.getElementById('r_valor').value = (q * v).toFixed(2); }
function calcularTotalDespesa() { let q = parseFloat(document.getElementById('d_qtd').value) || 0; let v = parseFloat(document.getElementById('d_v_unit').value) || 0; if (q>0 && v>0) document.getElementById('d_valor').value = (q * v).toFixed(2); }

function confirmarExclusao(id) { 
    if(confirm('EXCLUIR lançamento?')) { 
        let t = transacoes.find(x => x.id === id);
        if(t) { t.deleted = true; t.updatedAt = Date.now(); salvarDados(); preencherSelectsSafraFin(); preencherSelectsLancamento(); atualizarOpcoesFiltros(); aplicarFiltros(); mostrarToast("REMOVIDO!"); }
    } 
}

function abrirModalEdicao(id) {
    const t = transacoes.find(x => x.id === id); if(!t || t.deleted) return;
    document.getElementById('modal-edicao').dataset.editId = id; 
    
    let vCat = strEscape(t.categoria); let vSet = strEscape(t.setor); let vLoc = strEscape(t.local); let vDesc = strEscape(t.desc);
    let tipoLowerT = String(t.tipo).toLowerCase();
    let htmlSel = tipoLowerT === 'receita' ? `<input type="hidden" id="ed_tipo" value="Receita">` : `
        <div><label>TIPO:</label><select id="ed_tipo"><option value="Despesa" ${tipoLowerT === 'despesa' ? 'selected' : ''}>CUSTEIO</option><option value="Investimento" ${tipoLowerT === 'investimento' ? 'selected' : ''}>INVESTIMENTO</option></select></div>`;

    let sitPago = strSafe(t.sit).toLowerCase().includes('pago') ? 'selected' : '';
    let sitPagar = (!sitPago && tipoLowerT !== 'receita') ? 'selected' : '';
    let sitReceber = (!sitPago && tipoLowerT === 'receita') ? 'selected' : '';
    
    let selectSit = tipoLowerT === 'receita' ? 
        `<option value="A receber" ${sitReceber}>A RECEBER</option><option value="Pago" ${sitPago}>PAGO</option>` :
        `<option value="A pagar" ${sitPagar}>A PAGAR</option><option value="Pago" ${sitPago}>PAGO</option>`;

    document.getElementById('form-edicao').innerHTML = `
        <div><label>DATA:</label> <input type="date" id="ed_data" value="${sanitizeDateString(t.data)}"></div> ${htmlSel}
        <div><label>CATEGORIA:</label> <input type="text" id="ed_categoria" value="${vCat}"></div>
        <div><label>SETOR:</label> <input type="text" id="ed_setor" value="${vSet}"></div>
        <div style="grid-column: span 2;"><label>LOCAL:</label> <input type="text" id="ed_local" value="${vLoc}"></div>
        <div style="grid-column: span 2;"><label>DESCRIÇÃO:</label> <input type="text" id="ed_desc" value="${vDesc}"></div>
        <div><label>QTD:</label> <input type="number" id="ed_qtd" step="0.01" value="${parseFloat(t.qtd)||0}"></div>
        <div><label>UNID:</label> <input type="text" id="ed_und" value="${strEscape(t.und)}"></div>
        <div><label>VALOR TOTAL:</label> <input type="number" id="ed_valor" step="0.01" value="${parseFloat(t.valor)||0}"></div>
        <div><label>SITUAÇÃO:</label> <select id="ed_sit">${selectSit}</select></div>
    `;
    document.getElementById('modal-edicao').style.display = 'flex';
}

function fecharModal() { document.getElementById('modal-edicao').style.display = 'none'; }
function guardarEdicao() {
    const id = document.getElementById('modal-edicao').dataset.editId;
    const t = transacoes.find(x => x.id === id);
    if (t) {
        t.data = sanitizeDateString(document.getElementById('ed_data').value); t.tipo = document.getElementById('ed_tipo').value;
        t.categoria = document.getElementById('ed_categoria').value.trim().toUpperCase(); t.setor = document.getElementById('ed_setor').value.trim().toUpperCase();
        t.local = document.getElementById('ed_local').value.trim().toUpperCase(); t.desc = document.getElementById('ed_desc').value.trim().toUpperCase();
        t.qtd = document.getElementById('ed_qtd').value; t.und = document.getElementById('ed_und').value.trim().toUpperCase();
        t.valor = parseFloat(document.getElementById('ed_valor').value) || 0; t.sit = document.getElementById('ed_sit').value;
        t.updatedAt = Date.now();
        salvarDados(); fecharModal(); preencherSelectsSafraFin(); preencherSelectsLancamento(); atualizarOpcoesFiltros(); aplicarFiltros(); 
    }
}

function atualizarOpcoesFiltros() {
    let cats = new Set(), sets = new Set(), locs = new Set(), descs = new Set();
    transacoes.forEach(t => {
        if(t.deleted) return;
        let cat = strSafe(t.categoria); if (!cat || cat === '-') cat = (String(t.tipo).toLowerCase() === 'receita') ? strSafe(t.desc) : strSafe(t.setor);
        if(cat && cat !== '-') cats.add(String(cat).toUpperCase());
        if(strSafe(t.setor) && t.setor !== '-') sets.add(strSafe(t.setor).toUpperCase());
        if(strSafe(t.local) && t.local !== '-') locs.add(strSafe(t.local).toUpperCase());
        if(strSafe(t.desc) && t.desc !== '-') descs.add(strSafe(t.desc).toUpperCase());
    });
    function preencher(id, setVals) { const sel = document.getElementById(id); if(sel) { const val = sel.value; sel.innerHTML = '<option value="">TUDO</option>' + Array.from(setVals).sort().map(v => `<option value="${strEscape(v.toLowerCase())}">${strEscape(v)}</option>`).join(''); sel.value = val; } }
    preencher('f_cat', cats); preencher('f_setor', sets); preencher('f_local', locs); preencher('f_desc', descs);
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

    let lista = transacoes.filter(t => {
        if(t.deleted) return false;
        let cM = strSafe(t.categoria); if (!cM || cM === '-') cM = (String(t.tipo).toLowerCase() === 'receita') ? strSafe(t.desc) : strSafe(t.setor);
        if(pG && !`${strSafe(t.desc)} ${strSafe(t.local)} ${cM} ${strSafe(t.setor)} ${t.tipo}`.toLowerCase().includes(pG)) return false;
        if(fD && sanitizeDateString(t.data) !== fD) return false;
        if(fT && String(t.tipo).toLowerCase() !== fT) return false;
        if(fC && cM.toLowerCase() !== fC) return false;
        if(fSe && strSafe(t.setor).toLowerCase() !== fSe) return false;
        if(fL && strSafe(t.local).toLowerCase() !== fL) return false;
        if(fDe && strSafe(t.desc).toLowerCase() !== fDe) return false;
        if(fSi && strSafe(t.sit).toLowerCase() !== fSi) return false;
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
                <tr class="${isAtrasado ? 'tr-alerta' : ''}">
                    <td>${formatarData(t.data)}</td><td><div class="badge-tipo ${badgeTipo}">${String(t.tipo).toUpperCase()}</div></td><td><b style="color:var(--cor-texto); font-weight:700;">${strEscape(cM)}</b></td>
                    <td>${strEscape(t.setor)}</td><td>${strEscape(t.local)}</td><td>${strEscape(t.desc)}</td>
                    <td>${strSafe(t.qtd)} ${strEscape(t.und)}</td><td>${formatarMoeda(t.v_unit)}</td>
                    <td style="font-weight:700; font-family:'Rubik'; color:var(--cor-texto);">${formatarMoeda(t.valor)}</td><td style="text-align: center; width: 100px;">${btnSit}</td>
                    <td class="no-print" style="text-align: center;">
                        <button onclick="abrirModalEdicao('${t.id}')" class="btn-acao btn-editar">✏️</button>
                        <button onclick="confirmarExclusao('${t.id}')" class="btn-acao btn-excluir">🗑️</button>
                    </td>
                </tr>`);
        } catch(e) {}
    });
    document.getElementById('tabela_relatorio').innerHTML = linhasHTML.join('') || '<tr><td colspan="11" style="text-align:center; padding: 30px; color:#aaa;">Sem lançamentos</td></tr>';
}

/* =========================================================================
   7. BLOCO AGRÍCOLA E ESTOQUE 
========================================================================= */
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
    if(!opcoesDin[categoria]) opcoesDin[categoria] = [];
    if (valor && valor !== '-' && !opcoesDin[categoria].includes(valor)) {
        opcoesDin[categoria].push(valor); opcoesDin[categoria].sort(); salvarDados(); renderDatalistsAgri(); 
    } return valor || '-';
}

function addAgriApp(e) {
    e.preventDefault();
    let produtoStr = document.getElementById('produto').value.toUpperCase(); let dosagemQtd = parseFloat(document.getElementById('dosagem_qtd').value); let dosagemUn = document.getElementById('dosagem_un').value; let tipoStr = verificarNovaOpcao('tipos', document.getElementById('tipo').value);
    let novoStatus = document.getElementById('status').value.toUpperCase();
    let dataLimpa = sanitizeDateString(document.getElementById('dataApp').value);
    
    const record = { id: generateUUID(), updatedAt: Date.now(), deleted: false, data: dataLimpa, talhao: verificarNovaOpcao('talhoes', document.getElementById('talhao').value), produto: produtoStr, tipo: tipoStr, alvo: verificarNovaOpcao('alvos', document.getElementById('alvo').value), dosagem: `${dosagemQtd} ${dosagemUn}`, dosagem_qtd: dosagemQtd, dosagem_un: dosagemUn, forma: verificarNovaOpcao('formas', document.getElementById('forma').value), status: novoStatus, custo_unit: 0 };
    const editId = document.getElementById('editAgriIndex').value;
    
    if (!editId) {
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
            record.custo_unit = old.custo_unit; 
            let idx = agriRecords.indexOf(old);
            agriRecords[idx] = record; 
            
            if (record.status === 'APLICADO' && record.data <= hojeLocal()) {
                let est = estoque.find(e => e && !e.deleted && e.produto === record.produto && e.un === record.dosagem_un);
                if(est) { est.qtd -= record.dosagem_qtd; est.updatedAt = Date.now(); }
            }
        }
        document.getElementById('editAgriIndex').value = ""; 
    }
    
    salvarDados(); popularSeletorSafraApp(); const ss = document.getElementById('safraSelector'); if(ss) ss.value = obterSafraGeral(record.data); aplicarFiltroSafraApp();
    document.getElementById('appForm').reset(); const st = document.getElementById('status'); if(st) st.value = 'PLANEJADO'; mostrarToast("Registro Agrícola Salvo!");
}

function toggleStatusApp(id) {
    const rec = agriRecords.find(r => r.id === id); if(!rec) return;
    const newStatus = rec.status === 'PLANEJADO' ? 'APLICADO' : 'PLANEJADO';
    const dataAppLocal = sanitizeDateString(rec.data);
    
    if (newStatus === 'APLICADO' && dataAppLocal > hojeLocal()) { alert("Data no futuro. Altere para baixar no estoque."); return; }

    rec.status = newStatus; rec.updatedAt = Date.now();
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
            let aviso = (rec.status === 'PLANEJADO' && (!itemEstoque || itemEstoque.qtd < rec.dosagem_qtd)) ? '<br><span class="stock-warning">⚠️ FALTA NO ESTOQUE</span>' : '';
            let custoTotal = (parseFloat(rec.dosagem_qtd)||0) * (itemEstoque ? (itemEstoque.valor_unit || 0) : (rec.custo_unit || 0));
            
            let cClass = ''; let tStr = String(rec.tipo||'').toUpperCase();
            if (tStr.includes('ADUBO') || tStr.includes('FERTILIZANTE')) cClass = 'linha-adubo';
            else if (tStr.includes('INSETICIDA')) cClass = 'linha-inseticida';
            else if (tStr.includes('FUNGICIDA')) cClass = 'linha-fungicida';
            else if (tStr.includes('HERBICIDA')) cClass = 'linha-herbicida';

            html += `<tr class="${cClass}">
                <td>${formatarData(rec.data)}</td><td>${strEscape(rec.talhao)}</td><td><b style="color:var(--cor-azul-flat);">${strEscape(rec.produto)}</b>${aviso}</td>
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
    const estRecord = { id: generateUUID(), updatedAt: Date.now(), deleted: false, produto: document.getElementById('est_produto').value.toUpperCase(), principio: document.getElementById('est_principio').value.toUpperCase(), tipo: verificarNovaOpcao('tipos', document.getElementById('est_tipo').value), qtd: parseFloat(document.getElementById('est_qtd').value), un: document.getElementById('est_un').value, valor_unit: parseFloat(document.getElementById('est_valor_unit').value) || 0 };
    const editId = document.getElementById('editEstoqueIndex').value;
    if (!editId) {
        const existing = estoque.find(item => item && !item.deleted && item.produto === estRecord.produto && item.un === estRecord.un);
        if(existing) { existing.qtd += estRecord.qtd; existing.valor_unit = estRecord.valor_unit; existing.principio = estRecord.principio || existing.principio; existing.updatedAt = Date.now(); } else estoque.push(estRecord);
    } else { 
        let idx = estoque.findIndex(e => e.id === editId);
        if(idx > -1) { estRecord.id = estoque[idx].id; estoque[idx] = estRecord; }
        document.getElementById('editEstoqueIndex').value = ""; 
    }
    salvarDados(); renderDatalistsAgri(); saveAndRenderEstoque(); saveAndRenderApp(); document.getElementById('form_estoque').reset(); mostrarToast("Estoque Atualizado!");
}

function saveAndRenderEstoque() {
    let validEstoque = estoque.filter(e => e && !e.deleted && e.produto);
    validEstoque.sort((a, b) => String(a.produto||'').localeCompare(String(b.produto||'')));
    let html = ''; let somaTotal = 0;
    
    validEstoque.forEach(rec => {
        try {
            let demanda = 0; let mesAtual = hojeLocal().substring(0,7);
            agriRecords.forEach(r => { if(r && !r.deleted && r.status === 'PLANEJADO' && r.data && sanitizeDateString(r.data).startsWith(mesAtual) && r.produto === rec.produto && r.dosagem_un === rec.un) demanda += parseFloat(r.dosagem_qtd)||0; });
            
            let corQtd = ''; let aviso = ''; let cClass = ''; let tStr = String(rec.tipo||'').toUpperCase();
            if (tStr.includes('ADUBO')) cClass = 'linha-adubo'; else if (tStr.includes('INSETICIDA')) cClass = 'linha-inseticida'; else if (tStr.includes('FUNGICIDA')) cClass = 'linha-fungicida'; else if (tStr.includes('HERBICIDA')) cClass = 'linha-herbicida';

            let qEstoque = parseFloat(rec.qtd)||0;
            if(qEstoque < 0) { cClass = 'tr-alerta'; corQtd = 'color: #c0392b; font-weight: 700;'; aviso = `<br><span class="stock-warning">⚠️ SALDO NEGATIVO</span>`; } 
            else if (qEstoque < demanda) { cClass = 'tr-alerta'; corQtd = 'color: #c0392b; font-weight: 700;'; aviso = `<br><span class="stock-warning">⚠️ PRECISA DE ${demanda.toFixed(2)} ${rec.un}</span>`; }

            let vTot = qEstoque > 0 ? (qEstoque * (rec.valor_unit || 0)) : 0; somaTotal += vTot;

            html += `<tr class="${cClass}">
                <td><b style="color:var(--cor-laranja-flat);">${strEscape(rec.produto)}</b>${aviso}</td><td>${strEscape(rec.principio)||'-'}</td><td>${strEscape(rec.tipo)}</td>
                <td style="${corQtd}">${qEstoque.toFixed(2)} ${strSafe(rec.un)}</td><td>${formatarMoeda(rec.valor_unit)}</td><td style="font-weight:700; font-family:'Rubik'; color:var(--cor-texto);">${formatarMoeda(vTot)}</td>
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
    
    let dS = {}, dT = {}, dTp = {}, dCS = {}, dCT = {}; let tApp = 0, tPlan = 0, count = 0;
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
        let custo = parseFloat(rec.dosagem_qtd) * (itemEst ? (itemEst.valor_unit || 0) : (rec.custo_unit || 0));

        if (rec.status === 'APLICADO') {
            tApp += custo;
            if (!dS[safra]) dS[safra] = { L: 0, KG: 0 }; dS[safra][rec.dosagem_un] += parseFloat(rec.dosagem_qtd);
            dCS[safra] = (dCS[safra]||0) + custo;
            if (!dT[talhao]) dT[talhao] = { L: 0, KG: 0 }; dT[talhao][rec.dosagem_un] += parseFloat(rec.dosagem_qtd);
            dCT[talhao] = (dCT[talhao]||0) + custo;
            if (!dTp[rec.tipo]) dTp[rec.tipo] = { L: 0, KG: 0 }; dTp[rec.tipo][rec.dosagem_un] += parseFloat(rec.dosagem_qtd);
        } else { tPlan += custo; }
    });

    document.getElementById('kpi-aplicado').innerText = formatarMoeda(tApp); document.getElementById('kpi-planejado').innerText = formatarMoeda(tPlan); document.getElementById('kpi-registros').innerText = count;

    function genChart(obj, ctxId, type, labelsKeys, ds1, ds2, color1, color2) {
        if(obj) obj.destroy(); const ctx = document.getElementById(ctxId).getContext('2d');
        return new Chart(ctx, { type: type, data: { labels: labelsKeys.length ? labelsKeys : ['Sem Dados'], datasets: [{ label: 'LITROS (L)', data: labelsKeys.map(k => ds1(k)), backgroundColor: color1, borderRadius: 2 }, { label: 'QUILOS (KG)', data: labelsKeys.map(k => ds2(k)), backgroundColor: color2, borderRadius: 2 }]}, options: { responsive: true, maintainAspectRatio: false, plugins:{ legend:{position:'bottom'} }, layout: { padding: 10 } } });
    }

    const safrasK = Object.keys(dS).sort();
    chartS_Agri = genChart(chartS_Agri, 'chartCustoSafra', 'bar', Object.keys(dCS).sort(), k=>dCS[k], k=>0, '#9b59b6', 'transparent');
    if(chartS_Agri.data.datasets[0]) { chartS_Agri.data.datasets[0].label = 'CUSTO (R$)'; chartS_Agri.update(); }

    const talhoesK = Object.keys(dT).sort();
    chartT_Agri = genChart(chartT_Agri, 'chartTalhao', 'bar', talhoesK, k=>dT[k].L, k=>dT[k].KG, '#3498db', '#62d073');
    
    const tiposK = Object.keys(dTp).sort();
    if(chartTp_Agri) chartTp_Agri.destroy();
    chartTp_Agri = new Chart(document.getElementById('chartTipo').getContext('2d'), {
        type: 'doughnut', data: { labels: tiposK.length ? tiposK : ['Sem Dados'], datasets: [{ data: tiposK.length ? tiposK.map(k => dTp[k].L + dTp[k].KG) : [1], borderWidth: 0, hoverOffset: 4, backgroundColor: ['#f49f3e','#3498db','#62d073','#9b59b6','#e74c3c'] }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', layout: { padding: 15 } }
    });

    const costTalhoesK = Object.keys(dCT).sort();
    if(chartCT_Agri) chartCT_Agri.destroy();
    chartCT_Agri = new Chart(document.getElementById('chartCustoTalhao').getContext('2d'), {
        type: 'bar', data: { labels: costTalhoesK.length ? costTalhoesK : ['Sem Dados'], datasets: [{ label: 'CUSTO (R$)', data: costTalhoesK.map(k => dCT[k]), backgroundColor: '#f49f3e', borderRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: 10 } }
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
    sVal('est_produto', r.produto); sVal('est_principio', r.principio || ''); sVal('est_tipo', r.tipo); sVal('est_qtd', r.qtd); sVal('est_un', r.un); sVal('est_valor_unit', r.valor_unit || 0); sVal('editEstoqueIndex', id); 
}
function deleteEstoque(id) { 
    if(confirm("EXCLUIR ITEM DO ESTOQUE?")) { 
        let e = estoque.find(x=>x.id===id); 
        if(e) { e.deleted = true; e.updatedAt = Date.now(); salvarDados(); renderDatalistsAgri(); aplicarFiltroSafraApp(); } 
    } 
}

function updateFilterOptionsAgri(visibleRecords) {
    const filters = [ { id: 'f_agri_data', k: 'data', fmt: formatarData }, { id: 'f_agri_talhao', k: 'talhao' }, { id: 'f_agri_produto', k: 'produto' }, { id: 'f_agri_tipo', k: 'tipo' }, { id: 'f_agri_alvo', k: 'alvo' }, { id: 'f_agri_forma', k: 'forma' }, { id: 'f_agri_status', k: 'status' } ];
    filters.forEach(f => { const sel = document.getElementById(f.id); if(!sel) return; const val = sel.value; sel.innerHTML = '<option value="">TODOS</option>'; [...new Set(visibleRecords.map(r => f.fmt ? f.fmt(r[f.k]) : (r[f.k] || '-')))].sort().forEach(v => { if(v) sel.innerHTML += `<option value="${strEscape(v)}">${strEscape(v)}</option>`; }); sel.value = val; });
}
function limparFiltrosAgri() { ['f_agri_data','f_agri_talhao','f_agri_produto','f_agri_tipo','f_agri_alvo','f_agri_forma','f_agri_status'].forEach(id => { const el=document.getElementById(id); if(el) el.value = ""; }); filterAgriTable(); }

function filterAgriTable() {
    const ids = ['f_agri_data','f_agri_talhao','f_agri_produto','f_agri_tipo','f_agri_alvo','','f_agri_forma','','f_agri_status'];
    const fs = ids.map(id => { const el = document.getElementById(id); return el ? el.value : ""; });
    const rows = document.getElementById('tableBodyAgri').getElementsByTagName('tr');
    for (let i=0; i<rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td'); const pTxt = cells[2].innerText.split('⚠️')[0].trim();
        const match = [ fs[0]===""||cells[0].innerText.trim()===fs[0], fs[1]===""||cells[1].innerText.trim()===fs[1], fs[2]===""||pTxt===fs[2], fs[3]===""||cells[3].innerText.trim()===fs[3], fs[4]===""||cells[4].innerText.trim()===fs[4], true, fs[6]===""||cells[6].innerText.trim()===fs[6], true, fs[8]===""||cells[8].innerText.replace('🔄','').trim()===fs[8] ];
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
           vA = (a.dosagem_qtd||0) * (ae ? ae.valor_unit||0 : a.custo_unit||0);
           vB = (b.dosagem_qtd||0) * (be ? be.valor_unit||0 : b.custo_unit||0);
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
        let aviso = (rec.status === 'PLANEJADO' && (!itemEstoque || itemEstoque.qtd < rec.dosagem_qtd)) ? '<br><span class="stock-warning">⚠️ FALTA NO ESTOQUE</span>' : '';
        let custoTotal = (parseFloat(rec.dosagem_qtd)||0) * (itemEstoque ? (itemEstoque.valor_unit || 0) : (rec.custo_unit || 0));
        let cClass = ''; let tStr = String(rec.tipo||'').toUpperCase();
        if (tStr.includes('ADUBO') || tStr.includes('FERTILIZANTE')) cClass = 'linha-adubo'; else if (tStr.includes('INSETICIDA')) cClass = 'linha-inseticida'; else if (tStr.includes('FUNGICIDA')) cClass = 'linha-fungicida'; else if (tStr.includes('HERBICIDA')) cClass = 'linha-herbicida';

        html += `<tr class="${cClass}">
            <td>${formatarData(rec.data)}</td><td>${strEscape(rec.talhao)}</td><td><b style="color:var(--cor-azul-flat);">${strEscape(rec.produto)}</b>${aviso}</td>
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
}

function renderizarTabelaHistoricoSolo() {
    let html = ''; let lista = [...analisesSolo].filter(a => a && !a.deleted && a.data).sort((a, b) => new Date(sanitizeDateString(b.data)) - new Date(sanitizeDateString(a.data)));
    lista.forEach(an => { html += `<tr><td>${formatarData(an.data)}</td><td><b style="color:var(--cor-verde-flat);">${strEscape(an.talhao)}</b></td><td>${an.prof}</td><td>${an.ph_h2o}</td><td>${an.p_meh}</td><td>${an.k}</td><td>${an.v}%</td><td>${an.mo}</td><td style="text-align:center;"><button class="btn-acao btn-editar" onclick="editarAnaliseSolo('${an.id}')">✏️</button> <button class="btn-acao btn-excluir" onclick="excluirAnaliseSolo('${an.id}')">🗑️</button></td></tr>`; });
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
    let dFoliar = anFoliar ? [parseNS(anFoliar.b), parseNS(anFoliar.cu), parseNS(anFoliar.fe), parseNS(anFoliar.mn), parseNS(anFoliar.zn), parseNS(anFoliar.mo), parseNS(anFoliar.argila)/10] : [];
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

window.onload = () => { carregarDadosNuvem(); };
</script>
</body>
</html>