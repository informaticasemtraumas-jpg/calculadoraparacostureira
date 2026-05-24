let currentMode = 'have';
let lastSummary = '';

const comparisonWidths = [115, 120, 140, 150, 160, 180, 250, 300];

const tabs = document.querySelectorAll('.tab');
const form = document.querySelector('#calculatorForm');
const quantityGroup = document.querySelector('#quantityGroup');
const fabricSection = document.querySelector('#fabricSection');
const pieceSection = document.querySelector('#pieceSection');
const costSection = document.querySelector('#costSection');
const fabricLengthGroup = document.querySelector('#fabricLengthGroup');
const sheetModeSection = document.querySelector('#sheetModeSection');
const resultLeadEl = document.querySelector('#resultLead');
const resultsEl = document.querySelector('#results');
const alertsEl = document.querySelector('#alerts');
const summaryEl = document.querySelector('#summary');
const previewEl = document.querySelector('#layoutPreview');
const comparisonEl = document.querySelector('#widthComparison');
const copyButton = document.querySelector('#copyButton');
const clearButton = document.querySelector('#clearButton');

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

function clearRenderedResults(msg){resultLeadEl.innerHTML='';resultsEl.innerHTML='';previewEl.innerHTML='';comparisonEl.innerHTML='';summaryEl.textContent=msg;copyButton.classList.add('hidden');}

function calculate() {
  const input = getInputs();
  const errors = validateInputs(input);
  if (errors.length) { renderAlerts(errors.map(text=>({type:'danger',text}))); clearRenderedResults('Corrija as medidas para calcular.'); return; }
  if (currentMode === 'have') { const r=calculateHaveFabric(input); renderAlerts(r.alerts); renderHaveResults(input,r); renderLayoutPreview(input,r); }
  else if (currentMode === 'buy') { const r=calculateBuyFabric(input); renderAlerts(r.alerts); renderBuyResults(input,r); renderLayoutPreview(input,r); }
  else { const r=calculateFittedSheet(input); renderAlerts(r.alerts); renderSheetResults(input,r); }
  summaryEl.textContent=lastSummary; copyButton.classList.remove('hidden');
}

function setMode(mode){
  currentMode=mode;
  const isSheetMode = mode === 'sheet';
  tabs.forEach(t=>t.classList.toggle('active',t.dataset.mode===mode));
  quantityGroup.classList.toggle('hidden',mode!=='buy');
  fabricSection.classList.toggle('hidden',isSheetMode);
  pieceSection.classList.toggle('hidden',isSheetMode);
  costSection.classList.toggle('hidden',isSheetMode);
  fabricLengthGroup.classList.toggle('hidden',mode!=='have');
  sheetModeSection.classList.toggle('hidden',!isSheetMode);
  calculate();
}

document.querySelector('#mattressType').addEventListener('change', () => {
  const preset = getMattressPreset(document.querySelector('#mattressType').value);
  if (preset) { document.querySelector('#mattressWidth').value = preset.width; document.querySelector('#mattressLength').value = preset.length; }
  calculate();
});

tabs.forEach(tab=>tab.addEventListener('click',()=>setMode(tab.dataset.mode)));
document.querySelectorAll('.preset-btn').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#fabricWidth').value=button.dataset.width;calculate();}));
document.querySelectorAll('.sheet-preset-btn').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#sheetFabricWidth').value=button.dataset.width;calculate();}));
form.addEventListener('submit',event=>{event.preventDefault();calculate();});
form.addEventListener('input',()=>calculate());
clearButton.addEventListener('click',()=>{form.reset();document.querySelector('#fabricWidth').value=150;document.querySelector('#sheetFabricWidth').value=150;document.querySelector('#fabricLength').value=200;document.querySelector('#desiredQuantity').value=50;document.querySelector('#mattressWidth').value=150;document.querySelector('#mattressLength').value=190;document.querySelector('#mattressHeight').value=14;document.querySelector('#underturnAllowance').value=10;calculate();});
copyButton.addEventListener('click', async ()=>{try{await navigator.clipboard.writeText(lastSummary);copyButton.textContent='Resumo copiado!';setTimeout(()=>{copyButton.textContent='Copiar resumo';},1800);}catch(error){alert('Não foi possível copiar automaticamente.');}});

calculate();
