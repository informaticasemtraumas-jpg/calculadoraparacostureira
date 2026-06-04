
const hasWindow = typeof window !== 'undefined';
const supabaseClient = hasWindow && window.createSupabaseClient ? (window.supabaseClient || window.createSupabaseClient()) : null;
let currentUser = null;

const authStatusEl = document.querySelector('#authStatus');
const openAuthButton = document.querySelector('#openAuthButton');
const logoutButton = document.querySelector('#logoutButton');
const authModal = document.querySelector('#authModal');
const closeAuthButton = document.querySelector('#closeAuthButton');
const authFeedback = document.querySelector('#authFeedback');
const authName = document.querySelector('#authName');
const authEmail = document.querySelector('#authEmail');
const authPassword = document.querySelector('#authPassword');
const loginButton = document.querySelector('#loginButton');
const signupButton = document.querySelector('#signupButton');
const saveGate = document.querySelector('#saveGate');
const saveProjectButton = document.querySelector('#saveProjectButton');
const saveProjectFeedback = document.querySelector('#saveProjectFeedback');
const myProjectsSection = document.querySelector('#myProjectsSection');
const myProjectsList = document.querySelector('#myProjectsList');

function setAuthFeedback(text, isError) {
  if (!authFeedback) return;
  authFeedback.textContent = text || '';
  authFeedback.style.color = isError ? 'var(--danger)' : 'var(--muted)';
}

function setSaveFeedback(text, type = '') {
  if (!saveProjectFeedback) return;
  saveProjectFeedback.textContent = text || '';
  saveProjectFeedback.classList.remove('success', 'error');
  if (type) saveProjectFeedback.classList.add(type);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getProjectInput() {
  return {
    projectName: document.querySelector('#projectName').value.trim(),
    client: document.querySelector('#projectClient').value.trim(),
    notes: document.querySelector('#projectNotes').value.trim(),
    fabricWidth: getNumber('#projectFabricWidth'),
    pricePerMeter: getNumber('#projectPricePerMeter'),
    defaultMargin: getNumber('#projectDefaultMargin'),
    defaultSpacing: getNumber('#projectDefaultSpacing'),
    allowRotate: document.querySelector('#projectAllowRotate').checked
  };
}

function getColumnFromSchemaError(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const quotedMatch = message.match(/'([^']+)' column/);
  if (quotedMatch) return quotedMatch[1];
  const plainMatch = message.match(/column ([a-zA-Z0-9_]+) /);
  return plainMatch ? plainMatch[1] : '';
}

async function runWithAvailableColumns(tableName, payload, operation, selectColumns = '*') {
  let nextPayload = { ...payload };
  const removedColumns = new Set();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await operation(nextPayload).select(selectColumns).single();

    if (!error) return data;

    const missingColumn = getColumnFromSchemaError(error);
    if (!missingColumn || removedColumns.has(missingColumn) || !(missingColumn in nextPayload)) {
      throw error;
    }

    removedColumns.add(missingColumn);
    const { [missingColumn]: _removedValue, ...payloadWithoutMissingColumn } = nextPayload;
    nextPayload = payloadWithoutMissingColumn;
    console.warn(`Campo ${missingColumn} não encontrado em ${tableName}; tentando salvar sem esse campo.`);
  }

  throw new Error(`Não foi possível salvar em ${tableName}: muitas tentativas de ajuste de colunas.`);
}

async function insertWithAvailableColumns(tableName, payload, selectColumns = '*') {
  return runWithAvailableColumns(
    tableName,
    payload,
    nextPayload => supabaseClient.from(tableName).insert(nextPayload),
    selectColumns
  );
}

async function updateWithAvailableColumns(tableName, payload, matchColumns, selectColumns = '*') {
  return runWithAvailableColumns(
    tableName,
    payload,
    nextPayload => supabaseClient.from(tableName).update(nextPayload).match(matchColumns),
    selectColumns
  );
}


function updateSaveProjectButtonText() {
  if (!saveProjectButton || isSavingProject) return;
  saveProjectButton.textContent = projetoAtualId ? 'Salvar alterações' : 'Salvar projeto';
}

function setCurrentProjectState(projectId = null, calculationId = null) {
  projetoAtualId = projectId;
  calculoAtualId = calculationId;
  updateSaveProjectButtonText();
}

function resetCurrentProjectState() {
  setCurrentProjectState(null, null);
}

function clearProjectEditingState() {
  resetCurrentProjectState();
  setSaveFeedback('', '');
}

function clearAuthForm() {
  if (authName) authName.value = '';
  if (authEmail) authEmail.value = '';
  if (authPassword) authPassword.value = '';
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.add('hidden');
  authModal.classList.remove('active', 'visible');
  clearAuthForm();
}

function updateAuthUI() {
  if (!authStatusEl || !openAuthButton || !logoutButton) return;
  if (currentUser) {
    const name = currentUser.user_metadata?.nome || currentUser.email;
    authStatusEl.textContent = `Logada como: ${name} (${currentUser.email})`;
    openAuthButton.classList.add('hidden');
    logoutButton.classList.remove('hidden');
    if (saveGate) saveGate.textContent = 'Você pode salvar seus Projetos Livres nesta conta.';
    if (myProjectsSection) myProjectsSection.classList.remove('hidden');
    loadMyProjects().catch(error => {
      console.error('Erro ao carregar projetos salvos:', error);
      renderMyProjectsError();
    });
    inicializarCaixaAtelie().catch(error => {
      console.error('Erro ao carregar Caixa do Ateliê:', error);
      setCaixaFeedback('Não foi possível carregar o Caixa do Ateliê agora.', 'error');
    });
  } else {
    resetCurrentProjectState();
    authStatusEl.textContent = 'Modo visitante';
    openAuthButton.classList.remove('hidden');
    logoutButton.classList.add('hidden');
    if (saveGate) saveGate.textContent = 'Crie uma conta gratuita para salvar seus projetos.';
    if (myProjectsSection) myProjectsSection.classList.add('hidden');
    if (myProjectsList) myProjectsList.innerHTML = 'Entre para ver seus projetos salvos.';
    mostrarCaixaSemUsuario();
  }
}

async function createProfileForUser(user, nome) {
  const payload = {
    id: user.id,
    nome: nome || user.user_metadata?.nome || user.email,
    email: user.email,
    plano: 'free'
  };
  const { error } = await supabaseClient.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function handleSignup() {
  if (!supabaseClient) return setAuthFeedback('Configure o Supabase em supabase.js para ativar autenticação.', true);
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const nome = authName.value.trim();
  if (!email || !password || !nome) return setAuthFeedback('Preencha nome, e-mail e senha para cadastrar.', true);
  const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { nome } } });
  if (error) return setAuthFeedback(error.message, true);
  if (data.user) await createProfileForUser(data.user, nome);
  currentUser = data.user || currentUser;
  updateAuthUI();
  closeAuthModal();
  setAuthFeedback('Conta criada com sucesso. Se necessário, confirme o e-mail.', false);
}

async function handleLogin() {
  if (!supabaseClient) return setAuthFeedback('Configure o Supabase em supabase.js para ativar autenticação.', true);
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return setAuthFeedback(error.message, true);
  currentUser = data.user || null;
  updateAuthUI();
  closeAuthModal();
  setAuthFeedback('Login realizado com sucesso.', false);
}

async function handleLogout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  resetCurrentProjectState();
  updateAuthUI();
}

async function initAuth() {
  if (!supabaseClient) { updateAuthUI(); return; }
  const { data } = await supabaseClient.auth.getSession();
  currentUser = data?.session?.user || null;
  updateAuthUI();
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
  });
}
let currentMode = 'project';
let simpleMode = 'have';
let lastSummary = '';
let lastProjectInput = null;
let lastProjectResult = null;
let isSavingProject = false;
let projetoAtualId = null;
let calculoAtualId = null;

const comparisonWidths = [115, 120, 140, 150, 160, 180, 250, 300];

const tabs = document.querySelectorAll('.tab');
const form = document.querySelector('#calculatorForm');
const quantityGroup = document.querySelector('#quantityGroup');
const fabricSection = document.querySelector('#fabricSection');
const pieceSection = document.querySelector('#pieceSection');
const costSection = document.querySelector('#costSection');
const fabricLengthGroup = document.querySelector('#fabricLengthGroup');
const sheetModeSection = document.querySelector('#sheetModeSection');
const projectModeSection = document.querySelector('#projectModeSection');
const simpleModeSection = document.querySelector('#simpleModeSection');
const simpleTabs = document.querySelectorAll('.subtab');
const projectCutsList = document.querySelector('#projectCutsList');
const addProjectCutButton = document.querySelector('#addProjectCutButton');
const resultLeadEl = document.querySelector('#resultLead');
const resultsEl = document.querySelector('#results');
const alertsEl = document.querySelector('#alerts');
const summaryEl = document.querySelector('#summary');
const previewEl = document.querySelector('#layoutPreview');
const comparisonEl = document.querySelector('#widthComparison');
const copyButton = document.querySelector('#copyButton');
const clearButton = document.querySelector('#clearButton');
const caixaForm = document.querySelector('#caixaForm');
const caixaLancamentoId = document.querySelector('#caixaLancamentoId');
const caixaData = document.querySelector('#caixaData');
const caixaTipo = document.querySelector('#caixaTipo');
const caixaCentroCusto = document.querySelector('#caixaCentroCusto');
const caixaCategoria = document.querySelector('#caixaCategoria');
const caixaDescricao = document.querySelector('#caixaDescricao');
const caixaValor = document.querySelector('#caixaValor');
const caixaFormaPagamento = document.querySelector('#caixaFormaPagamento');
const caixaNome = document.querySelector('#caixaNome');
const caixaObservacao = document.querySelector('#caixaObservacao');
const caixaSalvarButton = document.querySelector('#caixaSalvarButton');
const caixaCancelarEdicaoButton = document.querySelector('#caixaCancelarEdicaoButton');
const caixaAuthMessage = document.querySelector('#caixaAuthMessage');
const caixaFeedback = document.querySelector('#caixaFeedback');
const caixaAlertas = document.querySelector('#caixaAlertas');
const caixaResumo = document.querySelector('#caixaResumo');
const caixaLancamentosLista = document.querySelector('#caixaLancamentosLista');
const caixaRefreshButton = document.querySelector('#caixaRefreshButton');
const caixaFiltroMes = document.querySelector('#caixaFiltroMes');
const caixaFiltroTipo = document.querySelector('#caixaFiltroTipo');
const caixaFiltroCentro = document.querySelector('#caixaFiltroCentro');
const caixaFiltroCategoria = document.querySelector('#caixaFiltroCategoria');
const caixaFiltroBusca = document.querySelector('#caixaFiltroBusca');
let caixaLancamentosAtuais = [];
let caixaCategoriasAtuais = [];

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const meterFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getNumber(id) {
  const el = document.querySelector(id);
  const value = Number((el.value || '').replace?.(',', '.'));
  return Number.isFinite(value) ? value : 0;
}
const round = value => Math.round(value * 100) / 100;
const formatCm = value => `${decimalFormatter.format(round(value))} cm`;
const formatMeters = valueCm => `${meterFormatter.format(round(valueCm / 100))} m`;
const formatPieceMeasure = (width, length) => `${decimalFormatter.format(round(width))} x ${decimalFormatter.format(round(length))} cm`;
const formatSuggestedLength = valueCm => valueCm < 100 ? formatCm(valueCm) : formatMeters(valueCm);
const formatSuggestedLengthDetail = valueCm => valueCm < 100 ? formatCm(valueCm) : `${formatCm(valueCm)} / ${formatMeters(valueCm)}`;

function getInputs() {
  const activeFabricWidth = currentMode === 'sheet' ? getNumber('#sheetFabricWidth') : getNumber('#fabricWidth');
  return {
    fabricWidth: activeFabricWidth,
    fabricLength: getNumber('#fabricLength'),
    pieceWidth: getNumber('#pieceWidth'),
    pieceLength: getNumber('#pieceLength'),
    margin: getNumber('#margin'),
    spacing: getNumber('#spacing'),
    desiredQuantity: Math.max(1, Math.floor(getNumber('#desiredQuantity'))),
    pricePerMeter: getNumber('#pricePerMeter'),
    fabricPrice: getNumber('#fabricPrice'),
    boughtLength: getNumber('#boughtLength'),
    allowRotate: document.querySelector('#allowRotate').checked,
    mattressType: document.querySelector('#mattressType').value,
    mattressWidth: getNumber('#mattressWidth'),
    mattressLength: getNumber('#mattressLength'),
    mattressHeight: getNumber('#mattressHeight'),
    underturnAllowance: getNumber('#underturnAllowance')
  };
}

const { calculateHaveFabric, calculateBuyFabric, compareFabricWidths, calculateFittedSheet, getMattressPreset } = Calculator;
const { getFinalPieceSize, calculateFitCount, calculateOccupiedLength, roundUpPurchaseLength } = Calculator;

const renderResultItem = (value, label) => `<div class="result-item"><strong>${value}</strong><span>${label}</span></div>`;
const renderAlerts = alerts => { alertsEl.innerHTML = alerts.map(a => `<div class="alert ${a.type}">${a.text}</div>`).join(''); };

function renderLayoutPreview(input, result) {
  if (result.piecesAcross <= 0) return (previewEl.innerHTML = '');
  const rows = currentMode === 'have' ? result.rowsInLength : result.rowsNeeded;
  const totalPieces = currentMode === 'have' ? result.totalPieces : input.desiredQuantity;
  const piecesToRender = Math.min(totalPieces, 60);
  const omitted = totalPieces - piecesToRender;
  let pieces = '';
  for (let i = 0; i < piecesToRender; i += 1) pieces += `<span class="preview-piece" title="Peça ${i + 1}">${i + 1}</span>`;
  previewEl.innerHTML = `<div class="layout-preview"><h3>Visualização aproximada do encaixe</h3><p>${result.piecesAcross} peça(s) por faixa em ${rows} fileira(s).</p>${result.rotated ? '<p>Visualização com a peça girada.</p>' : ''}<div class="fabric-preview" style="--pieces-across:${result.piecesAcross};">${pieces}</div>${omitted > 0 ? `<p class="preview-note">+ ${omitted} peça(s) não exibidas para manter a visualização simples.</p>` : ''}</div>`;
}

function renderSheetPreview(result) {
  if (!result.fitsWidth) return (previewEl.innerHTML = '');
  previewEl.innerHTML = `<div class="layout-preview"><h3>Visualização aproximada do encaixe</h3><div class="sheet-preview"><div class="sheet-label width-label">${formatCm(result.cutWidth)}</div><div class="sheet-label length-label">${formatCm(result.cutLength)}</div><div class="sheet-corner tl">${round(result.cornerSquare)} x ${round(result.cornerSquare)}</div><div class="sheet-corner tr">${round(result.cornerSquare)} x ${round(result.cornerSquare)}</div><div class="sheet-corner bl">${round(result.cornerSquare)} x ${round(result.cornerSquare)}</div><div class="sheet-corner br">${round(result.cornerSquare)} x ${round(result.cornerSquare)}</div></div></div>`;
}

function renderWidthComparison(input) { const c = compareFabricWidths(input, comparisonWidths); comparisonEl.innerHTML = `<section class="width-comparison"><h3>Comparar larguras de tecido</h3><p>Veja qual largura pode render melhor para esta compra.</p><div class="table-wrap"><table><thead><tr><th>Largura</th><th>Peças por faixa</th><th>Fileiras</th><th>Necessário</th><th>Sugestão</th></tr></thead><tbody>${c.map(i => i.fits ? `<tr class="${i.isBest ? 'best-option' : ''}"><td>${formatCm(i.width)}</td><td>${i.piecesAcross}</td><td>${i.rowsNeeded}</td><td>${formatMeters(i.neededLength)}</td><td>${formatSuggestedLength(i.suggestedLength)}${i.isBest ? '<span class="best-badge">Melhor aproveitamento</span>' : ''}</td></tr>` : `<tr><td>${formatCm(i.width)}</td><td colspan="4">Não cabe</td></tr>`).join('')}</tbody></table></div></section>`; }

function renderSheetResults(input, result) {
  comparisonEl.innerHTML = '';
  if (result.fitsWidth) {
    resultLeadEl.textContent = `Para esse lençol, você precisa cortar um retângulo de ${round(result.cutWidth)} x ${round(result.cutLength)} cm e comprar aproximadamente ${formatSuggestedLength(result.suggestedLength)} de tecido.`;
  } else {
    resultLeadEl.textContent = `Esse lençol precisa de ${round(result.cutWidth)} cm de largura, mas o tecido informado tem apenas ${round(input.fabricWidth)} cm.`;
  }

  const costItems = result.pricePerMeter > 0 && result.fitsWidth ? renderResultItem(moneyFormatter.format(result.totalCost), 'Custo estimado') : '';
  resultsEl.innerHTML = [
    renderResultItem(formatPieceMeasure(result.cutWidth, result.cutLength), 'Medida final do corte'),
    renderResultItem(formatMeters(result.neededLength), 'Quanto comprar'),
    renderResultItem(formatSuggestedLengthDetail(result.suggestedLength), 'Sugestão de compra arredondada'),
    renderResultItem(formatPieceMeasure(result.cornerSquare, result.cornerSquare), 'Cantos a cortar (4x)'),
    renderResultItem(formatCm(result.sideDrop), 'Queda lateral total'),
    costItems
  ].join('');

  lastSummary = `🛏️ Resumo do lençol com elástico\n\nColchão: ${round(input.mattressWidth)} x ${round(input.mattressLength)} cm\nAltura do colchão: ${formatCm(input.mattressHeight)}\nSobra para virar: ${formatCm(input.underturnAllowance)}\nQueda lateral total: ${formatCm(result.sideDrop)}\n\nCorte:\nRetângulo: ${round(result.cutWidth)} x ${round(result.cutLength)} cm\nCantos: cortar 4 quadrados de ${round(result.cornerSquare)} x ${round(result.cornerSquare)} cm\n\nTecido:\nLargura do tecido: ${formatCm(input.fabricWidth)}\nComprar: ${formatMeters(result.neededLength)}\nSugestão: ${formatSuggestedLength(result.suggestedLength)}\n\nObservação:\n${result.fitsWidth ? 'O tecido cabe na largura informada.' : 'A largura do tecido não é suficiente para esse corte.'}`;

  renderSheetPreview(result);
}

function createProjectCutRow() {
  return `<div class="grid project-cut-row" style="margin-bottom:10px;"><div><label>Nome do item</label><input type="text" class="project-cut-name" placeholder="Ex: Fronha" /></div>
  <div><label>Largura do corte (cm)</label><input type="number" min="0" step="0.1" class="project-cut-width" /></div>
  <div><label>Comprimento do corte (cm)</label><input type="number" min="0" step="0.1" class="project-cut-length" /></div>
  <div><label>Quantidade</label><input type="number" min="1" step="1" value="1" class="project-cut-qty" /></div>
  <div><label>Margem específica (opcional)</label><input type="number" min="0" step="0.1" class="project-cut-margin" /></div>
  <div><label>Espaçamento específico (opcional)</label><input type="number" min="0" step="0.1" class="project-cut-spacing" /></div>
  <div><label class="checkbox-row"><input type="checkbox" class="project-cut-rotate" /> Permitir girar item</label></div>
  <div><button type="button" class="secondary-btn project-remove-cut">Remover corte</button></div></div>`;
}

function getProjectCuts(defaultMargin, defaultSpacing, defaultRotate) {
  return Array.from(projectCutsList.querySelectorAll('.project-cut-row')).map((row, index) => {
    const itemMargin = Number(row.querySelector('.project-cut-margin').value || defaultMargin);
    const itemSpacing = Number(row.querySelector('.project-cut-spacing').value || defaultSpacing);
    return {
      name: row.querySelector('.project-cut-name').value || `Item ${index + 1}`,
      width: Number(row.querySelector('.project-cut-width').value || 0),
      length: Number(row.querySelector('.project-cut-length').value || 0),
      quantity: Math.max(1, Math.floor(Number(row.querySelector('.project-cut-qty').value || 1))),
      margin: Number.isFinite(itemMargin) ? itemMargin : defaultMargin,
      spacing: Number.isFinite(itemSpacing) ? itemSpacing : defaultSpacing,
      allowRotate: row.querySelector('.project-cut-rotate').checked || defaultRotate
    };
  });
}

function calculateProject(input) {
  const cuts = getProjectCuts(input.defaultMargin, input.defaultSpacing, input.allowRotate);
  const alerts = [];
  const items = [];
  let totalLengthCm = 0;
  let totalQty = 0;
  let totalCost = 0;
  let notFitting = [];
  cuts.forEach(cut => {
    if (cut.width <= 0 || cut.length <= 0) return;
    const options = [false, true].filter(rot => !rot || cut.allowRotate);
    let best = null;
    options.forEach(rotated => {
      const w = rotated ? cut.length : cut.width;
      const l = rotated ? cut.width : cut.length;
      const final = getFinalPieceSize(w, l, cut.margin);
      const piecesAcross = calculateFitCount(input.fabricWidth, final.finalWidth, cut.spacing);
      if (piecesAcross <= 0) return;
      const rowsNeeded = Math.ceil(cut.quantity / piecesAcross);
      const neededLength = calculateOccupiedLength(rowsNeeded, final.finalLength, cut.spacing);
      if (!best || neededLength < best.neededLength) best = { ...final, piecesAcross, rowsNeeded, neededLength, rotated };
    });
    totalQty += cut.quantity;
    if (!best) { notFitting.push(cut.name); items.push({ cut, fits: false }); return; }
    const itemCost = input.pricePerMeter > 0 ? input.pricePerMeter * (best.neededLength / 100) : 0;
    totalLengthCm += best.neededLength;
    totalCost += itemCost;
    items.push({ cut, fits: true, ...best, itemCost });
  });
  if (notFitting.length) alerts.push({ type: 'danger', text: `Itens que não cabem na largura: ${notFitting.join(', ')}.` });
  else alerts.push({ type: 'success', text: 'Todos os cortes cabem na largura informada.' });
  return { items, alerts, totalLengthCm, totalQty, totalCost, suggestedLength: roundUpPurchaseLength(totalLengthCm), notFitting };
}

function getProjectPreviewColor(index) {
  const colors = ['#f9d8cf', '#d8e8ff', '#def3df', '#f7e2b7', '#eadcff', '#d9f2f0', '#ffdceb', '#e7ecff'];
  return colors[index % colors.length];
}

function pluralizePiece(quantity) {
  return quantity === 1 ? '1 peça' : `${quantity} peças`;
}

function pluralizeRow(quantity) {
  return quantity === 1 ? '1 fileira' : `${quantity} fileiras`;
}

function renderProjectDetailItem(item) {
  if (!item.fits) {
    return `<div class="project-detail-card project-detail-card-alert"><strong>Nome: ${escapeHtml(item.cut.name)}</strong><p>Este item não cabe na largura do tecido informado.</p></div>`;
  }

  const quantityText = pluralizePiece(item.cut.quantity);
  const widthText = item.piecesAcross === 1
    ? 'Cabe 1 peça lado a lado na largura do tecido'
    : `Cabem ${item.piecesAcross} peças lado a lado na largura do tecido`;

  return `<div class="project-detail-card">
    <strong>Nome: ${escapeHtml(item.cut.name)}</strong>
    <p><b>Quantidade:</b> ${quantityText}</p>
    <p><b>Cada peça mede:</b> ${formatCm(item.finalWidth)} de largura x ${formatCm(item.finalLength)} de comprimento</p>
    <p><b>Na largura:</b> ${widthText}</p>
    <p><b>No comprimento:</b> serão necessárias ${pluralizeRow(item.rowsNeeded)}</p>
    <p><b>Comprimento usado:</b> ${formatCm(item.neededLength)}</p>
  </div>`;
}

function renderProjectVisualPreview(input, result) {
  if (!previewEl) return;

  const fittingItems = result.items.filter(item => item.fits);
  const notFittingItems = result.items.filter(item => !item.fits);

  if (!fittingItems.length) {
    previewEl.innerHTML = `<section class="layout-preview project-visual-preview"><h3>Visualização do projeto</h3><p class="preview-note">Informe cortes que caibam na largura do tecido para ver uma visualização aproximada.</p>${notFittingItems.length ? `<div class="project-preview-alert">Itens fora da largura: ${escapeHtml(notFittingItems.map(item => item.cut.name).join(', '))}.</div>` : ''}</section>`;
    return;
  }

  const totalLength = Math.max(result.totalLengthCm, 1);
  const previewHeight = Math.max(220, Math.min(520, (totalLength / Math.max(input.fabricWidth, 1)) * 220));
  const totalPieces = fittingItems.reduce((sum, item) => sum + item.cut.quantity, 0);
  const compact = totalPieces > 80 || fittingItems.length > 8;

  const strips = fittingItems.map((item, index) => {
    const maxPreviewPieces = compact ? 24 : 48;
    const previewPieces = Math.min(item.cut.quantity, maxPreviewPieces);
    const previewRows = Math.ceil(previewPieces / Math.max(item.piecesAcross, 1));
    const omittedPieces = item.cut.quantity - previewPieces;
    const stripHeight = Math.max(96, Math.min(260, 68 + (previewRows * 46)));
    const quantityText = pluralizePiece(item.cut.quantity);
    const widthFitText = item.piecesAcross === 1 ? 'Cabe 1 peça na largura do tecido.' : `Cabem ${item.piecesAcross} peças lado a lado na largura do tecido.`;
    const rowText = `Serão necessárias ${pluralizeRow(item.rowsNeeded)} no comprimento.`;
    const previewNote = omittedPieces > 0
      ? `<p class="project-preview-count">Mostrando prévia de ${previewPieces} de ${item.cut.quantity} peças.</p>`
      : '';
    let pieces = '';

    for (let pieceIndex = 0; pieceIndex < previewPieces; pieceIndex += 1) {
      pieces += `<span class="project-preview-piece" title="${escapeHtml(item.cut.name)} - peça ${pieceIndex + 1}">
        <strong>${escapeHtml(item.cut.name)}</strong>
        <small>${formatCm(item.finalWidth)} × ${formatCm(item.finalLength)}</small>
        <em>Peça ${pieceIndex + 1}</em>
      </span>`;
    }

    return `<div class="project-preview-strip" style="--item-color:${getProjectPreviewColor(index)}; --pieces-across:${Math.max(item.piecesAcross, 1)}; min-height:${round(stripHeight)}px;">
      <div class="project-preview-strip-header">
        <strong>${escapeHtml(item.cut.name)}</strong>
        <span>Cortar ${quantityText} de ${formatCm(item.finalWidth)} de largura por ${formatCm(item.finalLength)} de comprimento.</span>
        <span>${widthFitText} ${rowText} Usa ${formatCm(item.neededLength)} no comprimento do tecido.</span>
      </div>
      <div class="project-cut-shape-wrap">
        <div class="project-cut-measure width">Largura de cada peça: ${formatCm(item.finalWidth)}</div>
        <div class="project-preview-piece-grid">
          ${pieces}
        </div>
        ${previewNote}
        <div class="project-cut-measure length">Comprimento de cada peça: ${formatCm(item.finalLength)}</div>
      </div>
      <details class="project-preview-details">
        <summary>Ver explicação deste corte</summary>
        <div class="project-preview-detail-grid">
          <span><strong>Quantidade</strong>${quantityText}</span>
          <span><strong>Corte</strong>${formatCm(item.finalWidth)} largura × ${formatCm(item.finalLength)} comprimento</span>
          <span><strong>Na largura</strong>${widthFitText}</span>
          <span><strong>No comprimento</strong>${rowText} Comprimento usado: ${formatCm(item.neededLength)}</span>
        </div>
      </details>
    </div>`;
  }).join('');

  const notFittingAlert = notFittingItems.length
    ? `<div class="project-preview-alert">Não desenhado dentro do tecido: ${escapeHtml(notFittingItems.map(item => item.cut.name).join(', '))}, pois não cabe na largura informada.</div>`
    : '';

  previewEl.innerHTML = `<section class="layout-preview project-visual-preview">
    <h3>Visualização do projeto</h3>
    <p>Visualização aproximada. O cálculo numérico é a referência.</p>
    ${notFittingAlert}
    <div class="project-fabric-measure top">Largura do tecido: ${formatCm(input.fabricWidth)}</div>
    <div class="project-fabric-wrap">
      <div class="project-fabric-canvas" style="height:${round(previewHeight)}px;">
        ${strips}
      </div>
    </div>
    <div class="project-fabric-measure bottom">Comprimento total usado: ${formatCm(result.totalLengthCm)} (${formatMeters(result.totalLengthCm)})</div>
  </section>`;
}

function renderProjectResults(input, result) {
  const totalCuts = result.items.length;
  const costItem = input.pricePerMeter > 0 ? renderResultItem(moneyFormatter.format(result.totalCost), 'Custo estimado total') : '';
  resultsEl.innerHTML = [
    renderResultItem(formatMeters(result.totalLengthCm), 'Tecido total necessário'),
    renderResultItem(formatSuggestedLengthDetail(result.suggestedLength), 'Sugestão de compra'),
    costItem || renderResultItem('—', 'Custo estimado total (preencha o preço por metro para ver)'),
    renderResultItem(result.totalQty, 'Quantidade total de cortes'),
    renderResultItem(totalCuts, 'Itens cadastrados')
  ].join('');
  const itemLines = result.items.map(renderProjectDetailItem).join('');
  comparisonEl.innerHTML = `<details class="project-details"><summary>Ver detalhes dos cortes</summary><div class="details-list">${itemLines || '<p>Nenhum corte válido informado.</p>'}</div></details>`;
  renderProjectVisualPreview(input, result);
  resultLeadEl.textContent = `Projeto ${input.projectName || 'sem nome'}: total estimado de ${formatMeters(result.totalLengthCm)} de tecido.`;
  lastSummary = `📋 Projeto Livre\nProjeto: ${input.projectName || 'Sem nome'}\nCliente: ${input.client || '-'}\nObservações: ${input.notes || '-'}\nLargura do tecido: ${formatCm(input.fabricWidth)}\n\nCortes:\n${result.items.map(item=> item.fits ? `- ${item.cut.name}: ${item.cut.quantity} un, ${formatCm(item.neededLength)}` : `- ${item.cut.name}: não cabe`).join('\n')}\n\nTotal: ${formatCm(result.totalLengthCm)} (${formatMeters(result.totalLengthCm)})\nSugestão: ${formatSuggestedLength(result.suggestedLength)}${input.pricePerMeter>0?`\nCusto estimado: ${moneyFormatter.format(result.totalCost)}`:''}`;
}

function buildProjectSummaryForSave(input, result) {
  const cutLines = result.items.map(item => {
    if (!item.fits) return `- ${item.cut.name}: não cabe na largura do tecido`;
    return `- ${item.cut.name}: ${item.cut.quantity} un; corte ${formatPieceMeasure(item.cut.width, item.cut.length)}; margem ${formatCm(item.cut.margin)}; espaçamento ${formatCm(item.cut.spacing)}; permitir girar: ${item.cut.allowRotate ? 'sim' : 'não'}; ${item.rotated ? 'girado' : 'normal'}; medida final ${formatPieceMeasure(item.finalWidth, item.finalLength)}; ${item.piecesAcross} por faixa; ${item.rowsNeeded} fileira(s); comprimento ${formatCm(item.neededLength)}${input.pricePerMeter > 0 ? `; custo ${moneyFormatter.format(item.itemCost)}` : ''}`;
  });

  return `${lastSummary}\n\nItens detalhados:\n${cutLines.join('\n') || '- Nenhum corte válido informado.'}`;
}

function buildProjectPayload(input, includeUpdatedAt = false) {
  return {
    nome: input.projectName || 'Projeto Livre sem nome',
    categoria: 'Projeto Livre',
    observacoes: input.notes || null,
    ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {})
  };
}

function buildCalculationPayload(input, result, projectId, resumo, includeUpdatedAt = false) {
  return {
    user_id: currentUser.id,
    projeto_id: projectId,
    nome: input.projectName || 'Projeto Livre sem nome',
    tipo_calculo: 'projeto_livre',
    modo_calculo: 'projeto_livre',
    largura_tecido_cm: input.fabricWidth,
    preco_metro_linear: input.pricePerMeter || null,
    preco_tecido: input.pricePerMeter || null,
    margem_costura_cm: input.defaultMargin,
    espacamento_cm: input.defaultSpacing,
    permitir_girar: input.allowRotate,
    quantidade_desejada: result.totalQty || null,
    comprimento_necessario_cm: result.totalLengthCm,
    custo_estimado_total: result.totalCost || null,
    resumo,
    ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {})
  };
}

async function createSavedProject(input, result, resumo) {
  const project = await insertWithAvailableColumns('projetos', {
    user_id: currentUser.id,
    ...buildProjectPayload(input)
  }, 'id, nome, categoria, created_at');

  const calculation = await insertWithAvailableColumns('calculos_corte',
    buildCalculationPayload(input, result, project.id, resumo),
    'id'
  );

  setCurrentProjectState(project.id, calculation?.id || null);
  return 'Projeto salvo com sucesso.';
}

async function updateSavedProject(input, result, resumo) {
  await updateWithAvailableColumns('projetos',
    buildProjectPayload(input, true),
    { id: projetoAtualId, user_id: currentUser.id },
    'id'
  );

  if (calculoAtualId) {
    const calculation = await updateWithAvailableColumns('calculos_corte',
      buildCalculationPayload(input, result, projetoAtualId, resumo, true),
      { id: calculoAtualId, projeto_id: projetoAtualId, user_id: currentUser.id },
      'id'
    );
    calculoAtualId = calculation?.id || calculoAtualId;
  } else {
    const calculation = await insertWithAvailableColumns('calculos_corte',
      buildCalculationPayload(input, result, projetoAtualId, resumo),
      'id'
    );
    calculoAtualId = calculation?.id || null;
  }

  updateSaveProjectButtonText();
  return 'Projeto atualizado com sucesso.';
}

async function saveProject() {
  if (isSavingProject) return;
  if (currentMode !== 'project') {
    setSaveFeedback('O salvamento está disponível para Projeto Livre.', 'error');
    return;
  }
  if (!supabaseClient) {
    setSaveFeedback('Configure o Supabase para salvar seus projetos.', 'error');
    return;
  }
  if (!currentUser) {
    setSaveFeedback('Crie uma conta gratuita para salvar seus projetos.', 'error');
    return;
  }

  calculate();
  const input = lastProjectInput;
  const result = lastProjectResult;
  if (!input || !result || input.fabricWidth <= 0) {
    setSaveFeedback('Calcule um Projeto Livre válido antes de salvar.', 'error');
    return;
  }

  isSavingProject = true;
  if (saveProjectButton) {
    saveProjectButton.disabled = true;
    saveProjectButton.textContent = 'Salvando...';
  }
  setSaveFeedback('', '');

  try {
    const resumo = buildProjectSummaryForSave(input, result);
    const successMessage = projetoAtualId
      ? await updateSavedProject(input, result, resumo)
      : await createSavedProject(input, result, resumo);

    setSaveFeedback(successMessage, 'success');
    await loadMyProjects();
  } catch (error) {
    console.error('Erro completo ao salvar Projeto Livre:', error);
    setSaveFeedback('Não foi possível salvar o projeto. Tente novamente.', 'error');
  } finally {
    isSavingProject = false;
    if (saveProjectButton) {
      saveProjectButton.disabled = false;
      updateSaveProjectButtonText();
    }
  }
}

function formatProjectDate(value) {
  if (!value) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatInputNumber(value) {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function parseSavedNumber(value) {
  if (value === null || value === undefined) return 0;
  const normalized = String(value).replace(/[^0-9,.-]/g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseSavedBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 't', '1', 'sim', 'yes'].includes(value.toLowerCase());
  return Boolean(value);
}

function getSummaryField(summary, label) {
  const match = String(summary || '').match(new RegExp(`^${label}:\\s*(.*)$`, 'mi'));
  if (!match) return '';
  const value = match[1].trim();
  return value === '-' ? '' : value;
}

function setFieldValue(selector, value) {
  const field = document.querySelector(selector);
  if (field) field.value = formatInputNumber(value);
}

function setFieldChecked(selector, value) {
  const field = document.querySelector(selector);
  if (field) field.checked = Boolean(value);
}

function parseProjectCutsFromSummary(summary, defaultMargin, defaultSpacing, defaultAllowRotate) {
  const details = String(summary || '').split('Itens detalhados:')[1] || '';
  return details
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => {
      const match = line.match(/^- (.*?): (\d+) un; corte ([\d.,]+) x ([\d.,]+) cm; margem ([\d.,]+) cm; espaçamento ([\d.,]+) cm; (?:(?:permitir girar: (sim|não); )?)(girado|normal)/i);
      if (!match) return null;
      const allowRotateText = match[7];
      const orientation = match[8];
      return {
        name: match[1],
        quantity: Math.max(1, Math.floor(parseSavedNumber(match[2]))),
        width: parseSavedNumber(match[3]),
        length: parseSavedNumber(match[4]),
        margin: parseSavedNumber(match[5]),
        spacing: parseSavedNumber(match[6]),
        allowRotate: allowRotateText ? allowRotateText.toLowerCase() === 'sim' : (defaultAllowRotate || orientation === 'girado')
      };
    })
    .filter(Boolean);
}

function replaceProjectCutRows(cuts) {
  if (!projectCutsList || typeof projectCutsList.insertAdjacentHTML !== 'function') return;
  projectCutsList.innerHTML = '';
  const rowsToRender = cuts.length > 0 ? cuts : [{}];

  rowsToRender.forEach(cut => {
    projectCutsList.insertAdjacentHTML('beforeend', createProjectCutRow());
    const row = projectCutsList.querySelector('.project-cut-row:last-child');
    if (!row) return;
    row.querySelector('.project-cut-name').value = cut.name || '';
    row.querySelector('.project-cut-width').value = formatInputNumber(cut.width ?? '');
    row.querySelector('.project-cut-length').value = formatInputNumber(cut.length ?? '');
    row.querySelector('.project-cut-qty').value = formatInputNumber(cut.quantity ?? 1);
    row.querySelector('.project-cut-margin').value = formatInputNumber(cut.margin ?? '');
    row.querySelector('.project-cut-spacing').value = formatInputNumber(cut.spacing ?? '');
    row.querySelector('.project-cut-rotate').checked = Boolean(cut.allowRotate);
  });
}

function applySavedProjectToForm(project, calculation) {
  const summary = calculation?.resumo || '';
  const defaultMargin = parseSavedNumber(calculation?.margem_costura_cm);
  const defaultSpacing = parseSavedNumber(calculation?.espacamento_cm);
  const defaultAllowRotate = parseSavedBoolean(calculation?.permitir_girar);

  setMode('project');
  setFieldValue('#projectName', project?.nome || calculation?.nome || getSummaryField(summary, 'Projeto'));
  setFieldValue('#projectClient', project?.cliente || project?.nome_cliente || getSummaryField(summary, 'Cliente'));
  setFieldValue('#projectNotes', project?.observacoes || calculation?.observacoes || getSummaryField(summary, 'Observações'));
  setFieldValue('#projectFabricWidth', calculation?.largura_tecido_cm || parseSavedNumber(getSummaryField(summary, 'Largura do tecido')));
  setFieldValue('#projectPricePerMeter', calculation?.preco_metro_linear || calculation?.preco_tecido || '');
  setFieldValue('#projectDefaultMargin', defaultMargin);
  setFieldValue('#projectDefaultSpacing', defaultSpacing);
  setFieldChecked('#projectAllowRotate', defaultAllowRotate);

  replaceProjectCutRows(parseProjectCutsFromSummary(summary, defaultMargin, defaultSpacing, defaultAllowRotate));
  calculate();
}

async function openSavedProject(projectId) {
  if (!supabaseClient || !currentUser || !projectId) return;
  setSaveFeedback('Carregando projeto...', '');

  try {
    const { data: project, error: projectError } = await supabaseClient
      .from('projetos')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', currentUser.id)
      .single();

    if (projectError) throw projectError;

    const { data: calculation, error: calculationError } = await supabaseClient
      .from('calculos_corte')
      .select('*')
      .eq('projeto_id', projectId)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (calculationError) throw calculationError;

    applySavedProjectToForm(project, calculation || {});
    setCurrentProjectState(project.id, calculation?.id || null);
    setSaveFeedback('Projeto carregado com sucesso.', 'success');
  } catch (error) {
    console.error('Erro completo ao abrir Projeto Livre:', error);
    setSaveFeedback('Não foi possível abrir o projeto. Tente novamente.', 'error');
  }
}

const savedProjectActions = {
  open: openSavedProject,
  update: null,
  duplicate: null,
  delete: null
};

function renderMyProjectsError() {
  if (myProjectsList) myProjectsList.innerHTML = '<p class="saved-project-empty">Não foi possível carregar seus projetos agora.</p>';
}

async function loadMyProjects() {
  if (!supabaseClient || !currentUser || !myProjectsList) return;
  myProjectsList.innerHTML = '<p class="saved-project-empty">Carregando projetos...</p>';

  const { data, error } = await supabaseClient
    .from('projetos')
    .select('id, nome, categoria, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;

  if (!data || data.length === 0) {
    myProjectsList.innerHTML = '<p class="saved-project-empty">Nenhum projeto salvo ainda.</p>';
    return;
  }

  myProjectsList.innerHTML = data.map(project => `
    <article class="saved-project-item">
      <strong>${escapeHtml(project.nome || 'Projeto sem nome')}</strong>
      <span>${escapeHtml(project.categoria || 'Projeto Livre')} • ${formatProjectDate(project.created_at)}</span>
      <button class="secondary-btn saved-project-open" type="button" data-project-id="${escapeHtml(project.id)}">Abrir</button>
    </article>
  `).join('');
}


function setCaixaFeedback(text, type = '') {
  if (!caixaFeedback) return;
  caixaFeedback.textContent = text || '';
  caixaFeedback.classList.remove('success', 'error');
  if (type) caixaFeedback.classList.add(type);
}

function formatDateInputCaixa(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthInputCaixa(date = new Date()) {
  return formatDateInputCaixa(date).slice(0, 7);
}

function formatDateBrCaixa(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
}

function parseMoneyCaixa(value) {
  const normalized = String(value || '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function normalizeCaixaText(value) {
  return String(value || '').trim();
}

function traduzirCaixa(value) {
  const labels = {
    ENTRADA: 'Entrada',
    SAIDA: 'Saída',
    ATELIE: 'Ateliê',
    PESSOAL: 'Pessoal'
  };
  return labels[value] || value || '-';
}

function requireCaixaUser() {
  if (!supabaseClient) {
    setCaixaFeedback('Configure o Supabase em supabase.js para usar o Caixa do Ateliê.', 'error');
    return null;
  }
  if (!currentUser) {
    mostrarCaixaSemUsuario();
    return null;
  }
  if (caixaAuthMessage) caixaAuthMessage.textContent = '';
  return currentUser;
}

function mostrarCaixaSemUsuario() {
  const message = 'Entre na sua conta para usar o Caixa do Ateliê.';
  if (caixaAuthMessage) caixaAuthMessage.textContent = message;
  if (caixaData && !caixaData.value) caixaData.value = formatDateInputCaixa();
  if (caixaFiltroMes && !caixaFiltroMes.value) caixaFiltroMes.value = formatMonthInputCaixa();
  if (caixaFeedback) caixaFeedback.textContent = '';
  if (caixaAlertas) caixaAlertas.innerHTML = '';
  if (caixaResumo) caixaResumo.innerHTML = '';
  if (caixaLancamentosLista) caixaLancamentosLista.innerHTML = `<tr><td colspan="9">${message}</td></tr>`;
}

function resetarFormularioCaixa() {
  if (!caixaForm) return;
  caixaForm.reset();
  if (caixaLancamentoId) caixaLancamentoId.value = '';
  if (caixaData) caixaData.value = formatDateInputCaixa();
  if (caixaSalvarButton) caixaSalvarButton.textContent = 'Salvar lançamento';
  if (caixaCancelarEdicaoButton) caixaCancelarEdicaoButton.classList.add('hidden');
  carregarCategoriasCaixa().catch(error => {
    console.error('Erro ao recarregar categorias do Caixa:', error);
    setCaixaFeedback('Não foi possível carregar as categorias.', 'error');
  });
}

function preencherSelectCategoriasCaixa(select, categorias, placeholder) {
  if (!select) return;
  const currentValue = select.value;
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`]
    .concat(categorias.map(categoria => `<option value="${escapeHtml(categoria.nome)}">${escapeHtml(categoria.nome)}</option>`));
  select.innerHTML = options.join('');
  if (currentValue && categorias.some(categoria => categoria.nome === currentValue)) select.value = currentValue;
}

async function carregarCategoriasCaixa(options = {}) {
  const user = requireCaixaUser();
  if (!user) return [];

  const tipo = options.tipo || caixaTipo?.value || 'ENTRADA';
  const centroCusto = options.centroCusto || caixaCentroCusto?.value || 'ATELIE';
  const targetSelect = options.targetSelect || caixaCategoria;

  const { data, error } = await supabaseClient
    .from('caixa_categorias')
    .select('id, nome, tipo, centro_custo, user_id')
    .eq('ativo', true)
    .eq('tipo', tipo)
    .eq('centro_custo', centroCusto)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('nome', { ascending: true });

  if (error) throw error;
  const categorias = data || [];
  if (!options.targetSelect || targetSelect === caixaCategoria) caixaCategoriasAtuais = categorias;
  preencherSelectCategoriasCaixa(targetSelect, categorias, categorias.length ? 'Selecione uma categoria' : 'Nenhuma categoria encontrada');
  return categorias;
}

async function carregarCategoriasFiltroCaixa() {
  const user = requireCaixaUser();
  if (!user || !caixaFiltroCategoria) return [];

  let query = supabaseClient
    .from('caixa_categorias')
    .select('id, nome, tipo, centro_custo, user_id')
    .eq('ativo', true)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('nome', { ascending: true });

  if (caixaFiltroTipo?.value) query = query.eq('tipo', caixaFiltroTipo.value);
  if (caixaFiltroCentro?.value) query = query.eq('centro_custo', caixaFiltroCentro.value);

  const { data, error } = await query;
  if (error) throw error;

  const seen = new Set();
  const categorias = (data || []).filter(categoria => {
    if (seen.has(categoria.nome)) return false;
    seen.add(categoria.nome);
    return true;
  });
  preencherSelectCategoriasCaixa(caixaFiltroCategoria, categorias, 'Todas');
  return categorias;
}

function getCaixaPayload() {
  return {
    user_id: currentUser.id,
    data_movimento: caixaData?.value || formatDateInputCaixa(),
    tipo: caixaTipo?.value || 'ENTRADA',
    centro_custo: caixaCentroCusto?.value || 'ATELIE',
    categoria: normalizeCaixaText(caixaCategoria?.value),
    descricao: normalizeCaixaText(caixaDescricao?.value),
    valor: parseMoneyCaixa(caixaValor?.value),
    forma_pagamento: caixaFormaPagamento?.value || 'PIX',
    nome: normalizeCaixaText(caixaNome?.value),
    observacao: normalizeCaixaText(caixaObservacao?.value)
  };
}

function validarPayloadCaixa(payload) {
  const errors = [];
  if (!payload.data_movimento) errors.push('Informe a data do lançamento.');
  if (!payload.categoria) errors.push('Escolha uma categoria.');
  if (!payload.descricao) errors.push('Informe uma descrição simples.');
  if (payload.valor <= 0) errors.push('Informe um valor maior que zero.');
  return errors;
}

async function criarLancamentoCaixa() {
  const user = requireCaixaUser();
  if (!user) return null;
  const payload = getCaixaPayload();
  const errors = validarPayloadCaixa(payload);
  if (errors.length) {
    setCaixaFeedback(errors.join(' '), 'error');
    return null;
  }

  const { data, error } = await supabaseClient
    .from('caixa_lancamentos')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  setCaixaFeedback('Lançamento salvo com sucesso.', 'success');
  resetarFormularioCaixa();
  await listarLancamentosCaixa();
  return data;
}

async function atualizarLancamentoCaixa() {
  const user = requireCaixaUser();
  const lancamentoId = caixaLancamentoId?.value;
  if (!user || !lancamentoId) return null;
  const payload = getCaixaPayload();
  const { user_id: _userId, ...updatePayload } = payload;
  const errors = validarPayloadCaixa(payload);
  if (errors.length) {
    setCaixaFeedback(errors.join(' '), 'error');
    return null;
  }

  const { data, error } = await supabaseClient
    .from('caixa_lancamentos')
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq('id', lancamentoId)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) throw error;
  setCaixaFeedback('Lançamento atualizado com sucesso.', 'success');
  resetarFormularioCaixa();
  await listarLancamentosCaixa();
  return data;
}

async function excluirLancamentoCaixa(lancamentoId) {
  const user = requireCaixaUser();
  if (!user || !lancamentoId) return;
  if (!confirm('Excluir este lançamento do Caixa do Ateliê?')) return;

  const { error } = await supabaseClient
    .from('caixa_lancamentos')
    .delete()
    .eq('id', lancamentoId)
    .eq('user_id', user.id);

  if (error) throw error;
  setCaixaFeedback('Lançamento excluído.', 'success');
  await listarLancamentosCaixa();
}

function getFiltrosCaixa() {
  return {
    mes: caixaFiltroMes?.value || '',
    tipo: caixaFiltroTipo?.value || '',
    centroCusto: caixaFiltroCentro?.value || '',
    categoria: caixaFiltroCategoria?.value || '',
    busca: normalizeCaixaText(caixaFiltroBusca?.value)
  };
}

function aplicarFiltrosCaixa(query) {
  const filtros = getFiltrosCaixa();

  if (filtros.mes) {
    const [year, month] = filtros.mes.split('-').map(Number);
    const start = `${filtros.mes}-01`;
    const nextMonth = new Date(year, month, 1);
    const end = formatDateInputCaixa(nextMonth);
    query = query.gte('data_movimento', start).lt('data_movimento', end);
  }
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
  if (filtros.centroCusto) query = query.eq('centro_custo', filtros.centroCusto);
  if (filtros.categoria) query = query.eq('categoria', filtros.categoria);
  if (filtros.busca) {
    const term = filtros.busca.replaceAll('%', '').replaceAll(',', ' ');
    query = query.or(`descricao.ilike.%${term}%,nome.ilike.%${term}%`);
  }

  return query;
}

async function listarLancamentosCaixa() {
  const user = requireCaixaUser();
  if (!user) return [];
  if (!caixaLancamentosLista) return [];
  caixaLancamentosLista.innerHTML = '<tr><td colspan="9">Carregando lançamentos...</td></tr>';

  let query = supabaseClient
    .from('caixa_lancamentos')
    .select('*')
    .eq('user_id', user.id)
    .order('data_movimento', { ascending: false })
    .order('created_at', { ascending: false });

  query = aplicarFiltrosCaixa(query);
  const { data, error } = await query;
  if (error) throw error;

  caixaLancamentosAtuais = data || [];
  renderLancamentosCaixa(caixaLancamentosAtuais);
  calcularResumoCaixa(caixaLancamentosAtuais);
  return caixaLancamentosAtuais;
}

function renderLancamentosCaixa(lancamentos) {
  if (!caixaLancamentosLista) return;
  if (!lancamentos.length) {
    caixaLancamentosLista.innerHTML = '<tr><td colspan="9">Nenhum lançamento encontrado neste filtro.</td></tr>';
    return;
  }

  caixaLancamentosLista.innerHTML = lancamentos.map(lancamento => `
    <tr>
      <td>${formatDateBrCaixa(lancamento.data_movimento)}</td>
      <td><span class="caixa-badge ${lancamento.tipo === 'ENTRADA' ? 'entrada' : 'saida'}">${traduzirCaixa(lancamento.tipo)}</span></td>
      <td>${traduzirCaixa(lancamento.centro_custo)}</td>
      <td>${escapeHtml(lancamento.categoria)}</td>
      <td>${escapeHtml(lancamento.descricao)}</td>
      <td class="caixa-valor ${lancamento.tipo === 'ENTRADA' ? 'entrada' : 'saida'}">${moneyFormatter.format(Number(lancamento.valor) || 0)}</td>
      <td>${escapeHtml(lancamento.forma_pagamento)}</td>
      <td>${escapeHtml(lancamento.nome || '-')}</td>
      <td class="caixa-actions-cell">
        <button class="small-btn caixa-edit" type="button" data-id="${escapeHtml(lancamento.id)}">Editar</button>
        <button class="small-btn caixa-delete" type="button" data-id="${escapeHtml(lancamento.id)}">Excluir</button>
      </td>
    </tr>
  `).join('');
}

function renderResumoCardCaixa(value, label, extraClass = '') {
  return `<article class="result-item caixa-summary-card ${extraClass}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
}

function calcularResumoCaixa(lancamentos = caixaLancamentosAtuais) {
  const resumo = lancamentos.reduce((acc, lancamento) => {
    const valor = Number(lancamento.valor) || 0;
    if (lancamento.tipo === 'ENTRADA') acc.entradas += valor;
    if (lancamento.tipo === 'SAIDA') {
      acc.saidas += valor;
      acc.gastosPorCategoria[lancamento.categoria] = (acc.gastosPorCategoria[lancamento.categoria] || 0) + valor;
    }
    if (lancamento.tipo === 'ENTRADA' && lancamento.centro_custo === 'ATELIE') acc.entradasAtelie += valor;
    if (lancamento.tipo === 'SAIDA' && lancamento.centro_custo === 'ATELIE') acc.saidasAtelie += valor;
    if (lancamento.tipo === 'SAIDA' && lancamento.centro_custo === 'PESSOAL') acc.saidasPessoais += valor;
    return acc;
  }, {
    entradas: 0,
    saidas: 0,
    entradasAtelie: 0,
    saidasAtelie: 0,
    saidasPessoais: 0,
    gastosPorCategoria: {}
  });

  resumo.saldo = resumo.entradas - resumo.saidas;
  const maiorCategoria = Object.entries(resumo.gastosPorCategoria)
    .sort((a, b) => b[1] - a[1])[0];

  if (caixaResumo) {
    caixaResumo.innerHTML = [
      renderResumoCardCaixa(moneyFormatter.format(resumo.entradas), 'Total de entradas', 'entrada'),
      renderResumoCardCaixa(moneyFormatter.format(resumo.saidas), 'Total de saídas', 'saida'),
      renderResumoCardCaixa(moneyFormatter.format(resumo.saldo), 'Saldo', resumo.saldo < 0 ? 'saida' : 'entrada'),
      renderResumoCardCaixa(moneyFormatter.format(resumo.entradasAtelie), 'Entradas do ateliê'),
      renderResumoCardCaixa(moneyFormatter.format(resumo.saidasAtelie), 'Saídas do ateliê'),
      renderResumoCardCaixa(moneyFormatter.format(resumo.saidasPessoais), 'Saídas pessoais'),
      renderResumoCardCaixa(maiorCategoria ? `${maiorCategoria[0]} (${moneyFormatter.format(maiorCategoria[1])})` : 'Sem gastos', 'Maior categoria de gasto')
    ].join('');
  }

  const alertas = [];
  if (resumo.saldo < 0) alertas.push('Atenção: suas saídas passaram das entradas.');
  if (resumo.saidasPessoais > resumo.saidasAtelie) alertas.push('Atenção: os gastos pessoais estão maiores que os gastos do ateliê neste período.');
  if (caixaAlertas) caixaAlertas.innerHTML = alertas.map(text => `<div class="alert danger">${escapeHtml(text)}</div>`).join('');

  return { ...resumo, maiorCategoria };
}

function preencherFormularioEdicaoCaixa(lancamento) {
  if (!lancamento) return;
  if (caixaLancamentoId) caixaLancamentoId.value = lancamento.id;
  if (caixaData) caixaData.value = lancamento.data_movimento || formatDateInputCaixa();
  if (caixaTipo) caixaTipo.value = lancamento.tipo || 'ENTRADA';
  if (caixaCentroCusto) caixaCentroCusto.value = lancamento.centro_custo || 'ATELIE';
  carregarCategoriasCaixa().then(() => {
    if (caixaCategoria) caixaCategoria.value = lancamento.categoria || '';
  }).catch(error => {
    console.error('Erro ao carregar categorias para edição:', error);
    setCaixaFeedback('Não foi possível carregar a categoria deste lançamento.', 'error');
  });
  if (caixaDescricao) caixaDescricao.value = lancamento.descricao || '';
  if (caixaValor) caixaValor.value = moneyFormatter.format(Number(lancamento.valor) || 0).replace('R$', '').trim();
  if (caixaFormaPagamento) caixaFormaPagamento.value = lancamento.forma_pagamento || 'PIX';
  if (caixaNome) caixaNome.value = lancamento.nome || '';
  if (caixaObservacao) caixaObservacao.value = lancamento.observacao || '';
  if (caixaSalvarButton) caixaSalvarButton.textContent = 'Salvar alterações';
  if (caixaCancelarEdicaoButton) caixaCancelarEdicaoButton.classList.remove('hidden');
  caixaForm?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

async function inicializarCaixaAtelie() {
  if (!caixaForm) return;
  if (!currentUser) {
    mostrarCaixaSemUsuario();
    return;
  }
  if (caixaAuthMessage) caixaAuthMessage.textContent = '';
  if (!caixaData?.value) caixaData.value = formatDateInputCaixa();
  if (caixaFiltroMes && !caixaFiltroMes.value) caixaFiltroMes.value = formatMonthInputCaixa();
  await carregarCategoriasCaixa();
  await carregarCategoriasFiltroCaixa();
  await listarLancamentosCaixa();
}

function renderHaveResults(input, result) { /* unchanged simplified */
  if (result.piecesAcross <= 0 || result.totalPieces <= 0) { resultLeadEl.textContent = 'Com essas medidas, essa peça não cabe neste tecido.'; resultsEl.innerHTML = ''; comparisonEl.innerHTML = ''; lastSummary = '✂️ Resumo do corte\n\nEssa peça não coube no tecido informado.'; return; }
  resultLeadEl.innerHTML = `Com essas medidas, cabem <strong>${result.totalPieces} peça(s)</strong> neste tecido.`;
  const cost = result.pricePerMeter > 0 ? [renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'), renderResultItem(moneyFormatter.format(result.costPerPiece), 'Custo por peça')].join('') : '';
  resultsEl.innerHTML = [renderResultItem(result.totalPieces,'Peças que cabem'),renderResultItem(result.piecesAcross,'Peças por faixa/largura'),renderResultItem(result.rowsInLength,'Fileiras no comprimento'),renderResultItem(formatCm(result.usedLength),'Comprimento usado'),renderResultItem(formatCm(Math.max(result.remainingLength,0)),'Sobra de tecido'),cost].join('');
  comparisonEl.innerHTML='';
  lastSummary = `✂️ Resumo do corte\n\nTecido: ${formatCm(input.fabricWidth)} de largura\nComprimento disponível: ${formatCm(input.fabricLength)}\nPeça: ${formatPieceMeasure(input.pieceWidth,input.pieceLength)}\nMargem: ${formatCm(input.margin)}\nEspaço entre peças: ${formatCm(input.spacing)}\nEncaixe: ${result.rotated?'peça girada':'peça normal'}\n\nResultado:\nCabem ${result.totalPieces} peças no tecido.`;
}

function renderBuyResults(input, result) {
  if (result.piecesAcross <= 0) { resultLeadEl.textContent='Nesta largura de tecido, essa peça não cabe. Veja abaixo se outra largura funciona melhor.'; resultsEl.innerHTML=''; renderWidthComparison(input); lastSummary='🧵 Resumo da compra\n\nEssa peça não coube na largura informada.'; return; }
  resultLeadEl.innerHTML=`Para fazer <strong>${input.desiredQuantity} peça(s)</strong>, você precisa comprar aproximadamente <strong>${formatMeters(result.neededLength)}</strong> de tecido.`;
  const cost = result.pricePerMeter > 0 ? [renderResultItem(moneyFormatter.format(result.pricePerMeter), 'Custo por metro linear'), renderResultItem(moneyFormatter.format(result.totalCost),'Custo estimado da produção')].join('') : '';
  resultsEl.innerHTML=[renderResultItem(formatCm(result.neededLength),'Comprimento necessário'),renderResultItem(formatSuggestedLengthDetail(result.suggestedLength),'Sugestão para comprar com segurança'),renderResultItem(result.piecesAcross,'Peças por faixa/largura'),renderResultItem(result.rowsNeeded,'Fileiras necessárias'),cost].join('');
  renderWidthComparison(input);
  lastSummary=`🧵 Resumo da compra\n\nVocê precisa de ${formatMeters(result.neededLength)} de tecido.\nSugestão de compra: ${formatSuggestedLength(result.suggestedLength)}`;
}

function validateInputs(input) {
  const errors = [];
  if (input.fabricWidth <= 0) errors.push('Informe a largura do tecido.');
  if (currentMode === 'have' && input.fabricLength <= 0) errors.push('Informe o comprimento disponível do tecido.');
  if (currentMode === 'sheet') {
    if (input.mattressWidth <= 0) errors.push('Informe a largura do colchão.');
    if (input.mattressLength <= 0) errors.push('Informe o comprimento do colchão.');
    if (input.mattressHeight < 0) errors.push('Informe uma altura do colchão válida.');
    if (input.underturnAllowance < 0) errors.push('Informe uma sobra para virar válida.');
    return errors;
  }
  if (input.pieceWidth <= 0) errors.push('Informe a largura da peça.');
  if (input.pieceLength <= 0) errors.push('Informe o comprimento da peça.');
  return errors;
}

function clearRenderedResults(msg){resultLeadEl.innerHTML='';resultsEl.innerHTML='';previewEl.innerHTML='';comparisonEl.innerHTML='';summaryEl.textContent=msg;summaryEl.classList.remove('hidden');copyButton.classList.add('hidden');}

function calculate() {
  if (currentMode === 'project') {
    const input = getProjectInput();
    if (input.fabricWidth <= 0) { renderAlerts([{ type: 'danger', text: 'Informe a largura do tecido do Projeto Livre.' }]); clearRenderedResults('Corrija as medidas para calcular.'); lastProjectInput = null; lastProjectResult = null; return; }
    const r = calculateProject(input);
    lastProjectInput = input;
    lastProjectResult = r;
    renderAlerts(r.alerts); renderProjectResults(input, r); summaryEl.textContent=lastSummary; summaryEl.classList.add('hidden'); copyButton.classList.remove('hidden'); return;
  }
  const input = getInputs();
  const errors = validateInputs(input);
  if (errors.length) { renderAlerts(errors.map(text=>({type:'danger',text}))); clearRenderedResults('Corrija as medidas para calcular.'); return; }
  if (currentMode === 'simple' && simpleMode === 'have') { const r=calculateHaveFabric(input); renderAlerts(r.alerts); renderHaveResults(input,r); renderLayoutPreview(input,r); }
  else if (currentMode === 'simple' && simpleMode === 'buy') { const r=calculateBuyFabric(input); renderAlerts(r.alerts); renderBuyResults(input,r); renderLayoutPreview(input,r); }
  else { const r=calculateFittedSheet(input); renderAlerts(r.alerts); renderSheetResults(input,r); }
  summaryEl.textContent=lastSummary; summaryEl.classList.add('hidden'); copyButton.classList.remove('hidden');
}

function setMode(mode){
  currentMode=mode;
  const isSheetMode = mode === 'sheet';
  const isSimpleMode = mode === 'simple';
  const activeSimple = isSimpleMode ? simpleMode : 'have';
  tabs.forEach(t=>t.classList.toggle('active',t.dataset.mode===mode));
  quantityGroup.classList.toggle('hidden',activeSimple!=='buy' || !isSimpleMode);
  projectModeSection.classList.toggle('hidden',mode!=='project');
  simpleModeSection.classList.toggle('hidden',!isSimpleMode);
  fabricSection.classList.toggle('hidden',!isSimpleMode);
  pieceSection.classList.toggle('hidden',!isSimpleMode);
  costSection.classList.toggle('hidden',!isSimpleMode);
  fabricLengthGroup.classList.toggle('hidden',activeSimple!=='have' || !isSimpleMode);
  sheetModeSection.classList.toggle('hidden',!isSheetMode);
  calculate();
}

function setSimpleMode(mode) {
  simpleMode = mode;
  simpleTabs.forEach(t=>t.classList.toggle('active', t.dataset.simpleMode === mode));
  if (currentMode === 'simple') setMode('simple');
}

document.querySelector('#mattressType').addEventListener('change', () => {
  const preset = getMattressPreset(document.querySelector('#mattressType').value);
  if (preset) { document.querySelector('#mattressWidth').value = preset.width; document.querySelector('#mattressLength').value = preset.length; }
  calculate();
});

tabs.forEach(tab=>tab.addEventListener('click',()=>setMode(tab.dataset.mode)));
simpleTabs.forEach(tab=>tab.addEventListener('click',()=>setSimpleMode(tab.dataset.simpleMode)));
document.querySelectorAll('.preset-btn').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#fabricWidth').value=button.dataset.width;calculate();}));
document.querySelectorAll('.project-preset-btn').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#projectFabricWidth').value=button.dataset.width;calculate();}));
document.querySelectorAll('.sheet-preset-btn').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#sheetFabricWidth').value=button.dataset.width;calculate();}));
form.addEventListener('submit',event=>{event.preventDefault();calculate();});
form.addEventListener('input',()=>calculate());
copyButton.addEventListener('click', async ()=>{try{await navigator.clipboard.writeText(lastSummary);copyButton.textContent='Resumo copiado!';setTimeout(()=>{copyButton.textContent='Copiar resumo';},1800);}catch(error){alert('Não foi possível copiar automaticamente.');}});

if (projectCutsList && typeof projectCutsList.insertAdjacentHTML === 'function') {
  addProjectCutButton.addEventListener('click',()=>{projectCutsList.insertAdjacentHTML('beforeend', createProjectCutRow());calculate();});
  projectCutsList.addEventListener('click',(event)=>{if(event.target.classList.contains('project-remove-cut')){event.target.closest('.project-cut-row').remove();calculate();}});
  clearButton.addEventListener('click',()=>{form.reset();projectCutsList.innerHTML='';projectCutsList.insertAdjacentHTML('beforeend', createProjectCutRow());document.querySelector('#projectFabricWidth').value=150;document.querySelector('#fabricWidth').value=150;document.querySelector('#sheetFabricWidth').value=150;document.querySelector('#fabricLength').value=200;document.querySelector('#desiredQuantity').value=50;document.querySelector('#mattressWidth').value=150;document.querySelector('#mattressLength').value=190;document.querySelector('#mattressHeight').value=14;document.querySelector('#underturnAllowance').value=10;clearProjectEditingState();calculate();});
  projectCutsList.insertAdjacentHTML('beforeend', createProjectCutRow());
} else {
  clearButton.addEventListener('click',()=>{form.reset();clearProjectEditingState();calculate();});
}
if (projectCutsList && typeof projectCutsList.insertAdjacentHTML === 'function' && projectModeSection && document.querySelector('#projectFabricWidth')) setMode('project');
else calculate();

if (openAuthButton) openAuthButton.addEventListener('click',()=>{ authModal.classList.remove('hidden'); setAuthFeedback('', false); });
if (closeAuthButton) closeAuthButton.addEventListener('click',()=>closeAuthModal());
if (loginButton) loginButton.addEventListener('click',()=>{ handleLogin().catch(error=>setAuthFeedback(error.message, true)); });
if (signupButton) signupButton.addEventListener('click',()=>{ handleSignup().catch(error=>setAuthFeedback(error.message, true)); });
if (logoutButton) logoutButton.addEventListener('click',()=>{ handleLogout().catch(error=>setAuthFeedback(error.message, true)); });
if (saveProjectButton) saveProjectButton.addEventListener('click',()=>{ saveProject().catch(error=>{
  console.error('Erro completo ao salvar Projeto Livre:', error);
  setSaveFeedback('Não foi possível salvar o projeto. Tente novamente.', 'error');
}); });
if (myProjectsList) myProjectsList.addEventListener('click', event => {
  const openButton = event.target.closest?.('.saved-project-open');
  if (!openButton) return;
  savedProjectActions.open(openButton.dataset.projectId);
});

if (caixaForm) caixaForm.addEventListener('submit', event => {
  event.preventDefault();
  const action = caixaLancamentoId?.value ? atualizarLancamentoCaixa : criarLancamentoCaixa;
  action().catch(error => {
    console.error('Erro completo ao salvar lançamento do Caixa:', error);
    setCaixaFeedback('Não foi possível salvar o lançamento. Tente novamente.', 'error');
  });
});
if (caixaTipo) caixaTipo.addEventListener('change', () => {
  carregarCategoriasCaixa().catch(error => {
    console.error('Erro ao carregar categorias do Caixa:', error);
    setCaixaFeedback('Não foi possível carregar as categorias.', 'error');
  });
});
if (caixaCentroCusto) caixaCentroCusto.addEventListener('change', () => {
  carregarCategoriasCaixa().catch(error => {
    console.error('Erro ao carregar categorias do Caixa:', error);
    setCaixaFeedback('Não foi possível carregar as categorias.', 'error');
  });
});
if (caixaCancelarEdicaoButton) caixaCancelarEdicaoButton.addEventListener('click', () => resetarFormularioCaixa());
if (caixaRefreshButton) caixaRefreshButton.addEventListener('click', () => {
  inicializarCaixaAtelie().catch(error => {
    console.error('Erro ao atualizar Caixa do Ateliê:', error);
    setCaixaFeedback('Não foi possível atualizar o Caixa do Ateliê.', 'error');
  });
});
[caixaFiltroMes, caixaFiltroTipo, caixaFiltroCentro, caixaFiltroCategoria].forEach(field => {
  if (!field) return;
  field.addEventListener('change', () => {
    if (field === caixaFiltroTipo || field === caixaFiltroCentro) {
      carregarCategoriasFiltroCaixa().catch(error => console.error('Erro ao atualizar categorias do filtro:', error));
    }
    listarLancamentosCaixa().catch(error => {
      console.error('Erro ao aplicar filtros do Caixa:', error);
      setCaixaFeedback('Não foi possível aplicar os filtros.', 'error');
    });
  });
});
if (caixaFiltroBusca) caixaFiltroBusca.addEventListener('input', () => {
  listarLancamentosCaixa().catch(error => {
    console.error('Erro ao buscar lançamentos do Caixa:', error);
    setCaixaFeedback('Não foi possível buscar os lançamentos.', 'error');
  });
});
if (caixaLancamentosLista) caixaLancamentosLista.addEventListener('click', event => {
  const editButton = event.target.closest?.('.caixa-edit');
  const deleteButton = event.target.closest?.('.caixa-delete');
  if (editButton) {
    const lancamento = caixaLancamentosAtuais.find(item => String(item.id) === String(editButton.dataset.id));
    preencherFormularioEdicaoCaixa(lancamento);
  }
  if (deleteButton) {
    excluirLancamentoCaixa(deleteButton.dataset.id).catch(error => {
      console.error('Erro completo ao excluir lançamento do Caixa:', error);
      setCaixaFeedback('Não foi possível excluir o lançamento. Tente novamente.', 'error');
    });
  }
});

initAuth().catch(()=>updateAuthUI());
