// default-master.js で読み込んだ DEFAULT_MASTER を初期値としてセット
let currentMaster = DEFAULT_MASTER;

let allOrders = [];
let currentSubtotal = 0;
let currentGrandTotal = 0;
let currentGrandPt = 0;
let currentItemsData = [];

// localStorageの安全な取得/設定用ヘルパー
function safeGetStorage(key, defaultVal) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  initMemberSubSelect();
  initRegMemberSubSelect();
  renderPresetMemberList();

  // ① サーバー上の最新 month_config.json を自動バックグラウンド取得
  try {
    const response = await fetch('./month_config.json?cache=' + new Date().getTime());
    if (response.ok) {
      const remoteConfig = await response.json();
      currentMaster = remoteConfig;
      // Master configuration is not saved in browser storage.
    }
  } catch (e) {
    // ② ネットワークオフライン等で取得できなかった場合は過去のキャッシュを利用
    // Keep bundled default master if offline.
  }

  renderUIFromMaster();
  
  // デフォルトで最初の月度をセット（必要な場合）
  if (currentMaster.activeMonths && currentMaster.activeMonths.length > 0) {
    const monthSelect = document.getElementById('month');
    if (monthSelect && !monthSelect.value) {
      monthSelect.value = currentMaster.activeMonths[0];
    }
  }
  updateCalc();
});

function initMemberSubSelect() {
  const memberIdSub = document.getElementById('memberIdSub');
  if (!memberIdSub) return;
  memberIdSub.innerHTML = '';
  for (let i = 0; i <= 20; i++) {
    const opt = document.createElement('option');
    const val = String(i).padStart(2, '0');
    opt.value = val;
    opt.textContent = val;
    memberIdSub.appendChild(opt);
  }
}

// 事前登録用のサフィックス初期化
function initRegMemberSubSelect() {
  const regSub = document.getElementById('regMemberIdSub');
  if (regSub) regSub.value = '00';
}

// 会員情報の保存
function savePreMemberInfo() {
  const mainId = document.getElementById('regMemberIdMain').value.trim();
  const subId = document.getElementById('regMemberIdSub').value;
  const name = document.getElementById('regFullName').value.trim();

  if (!mainId || !name) {
    alert("会員番号と氏名の両方を入力してください。");
    return;
  }

  const fullId = `${mainId}-${subId}`;
  let list = SalonMembers.read();
  
  const existIdx = list.findIndex(m => m.code === mainId);
  if (existIdx >= 0) {
    list[existIdx].name = name;
    list[existIdx].subId = subId;
  } else {
    list.push({ code: mainId, name, subId });
  }

  SalonMembers.write(list);
  alert(`「${name} (${fullId})」様を登録しました。`);

  document.getElementById('regMemberIdMain').value = '';
  document.getElementById('regFullName').value = '';
  renderPresetMemberList();
}

// 登録済みリストの描画 ＆ プルダウン更新
function renderPresetMemberList() {
  const list = SalonMembers.read();
  
  const listContainer = document.getElementById('registeredMembersList');
  if (listContainer) {
    if (list.length === 0) {
      listContainer.innerHTML = '<div style="color:var(--text-sub);">※登録されている会員情報はありません。</div>';
    } else {
      let html = '<div style="font-weight:bold; margin-bottom:4px;">【登録済み会員一覧】</div>';
      list.forEach((m, idx) => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0; border-bottom: 1px dashed var(--border-color);">
            <span><strong>${m.name}</strong> (${m.code})</span>
            <button type="button" onclick="deletePresetMember(${idx})" style="color:#c94b4b; border:none; background:none; cursor:pointer; font-size:0.75rem;">削除</button>
          </div>
        `;
      });
      listContainer.innerHTML = html;
    }
  }

  const select = document.getElementById('presetMemberSelect');
  if (select) {
    select.innerHTML = '<option value="">-- 登録リストから選択 --</option>';
    list.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${m.name} (${m.code})`;
      select.appendChild(opt);
    });
  }
}

// 登録情報の削除
function deletePresetMember(index) { alert('既存の会員情報を保護するため、削除機能は一時停止しています。'); }

// フォームへの自動入力反映
function applyPresetMember(index) {
  if (index === "") return;
  const list = SalonMembers.read();
  const target = list[index];
  if (target) {
    document.getElementById('memberIdMain').value = target.code;
    document.getElementById('memberIdSub').value = target.subId || '00';
    document.getElementById('fullName').value = target.name;
  }
}

function renderUIFromMaster() {
  // 月度プルダウン描画
  const monthSelect = document.getElementById('month');
  const currentVal = monthSelect.value;
  monthSelect.innerHTML = '<option value="">選択してください</option>';
  currentMaster.activeMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });
  if (currentMaster.activeMonths.includes(currentVal)) {
    monthSelect.value = currentVal;
  } else if (currentMaster.activeMonths.length > 0) {
    monthSelect.value = currentMaster.activeMonths[0];
  }

  // テキスト注文と同じ商品選択方式（画像注文書プレビュー）
  const tbody = document.getElementById('productTableBody');
  tbody.innerHTML = '';
  const pickerRows = document.getElementById('productPickerRows');
  pickerRows.replaceChildren();
  document.getElementById('addProductPicker').addEventListener('click', () => addBulkProductPicker());
  addBulkProductPicker();

  document.getElementById('month').addEventListener('change', updateCalc);

  togglePaymentFields();
  updateCalc();
}

function addBulkProductPicker() {
  const list = document.getElementById('productPickerRows');
  const row = document.createElement('div');
  row.className = 'bulk-picker-row';
  const product = document.createElement('select');
  product.className = 'item-select';
  product.setAttribute('aria-label','商品を選択');
  product.appendChild(new Option('商品を選択してください',''));
  const refreshLabels = () => {
    const selectedMonth = document.getElementById('month').value;
    currentMaster.products.forEach((p,i) => {
      const pts = p.pts?.[selectedMonth] ?? p.pt ?? 0;
      const option = product.options[i+1];
      option.dataset.fullLabel = p.name + ' (' + p.price.toLocaleString() + '円 / ' + Number(pts).toLocaleString() + 'pt)';
      option.textContent = option.dataset.fullLabel;
    });
  };
  currentMaster.products.forEach((p,i)=>product.appendChild(new Option(p.name,String(i))));
  refreshLabels();
  const compactLabel = () => {
    refreshLabels();
    if(product.value !== '') product.options[product.selectedIndex].textContent = currentMaster.products[Number(product.value)].name;
  };
  product.addEventListener('focus',refreshLabels);
  product.addEventListener('blur',compactLabel);
  product.addEventListener('change',compactLabel);
  document.getElementById('month').addEventListener('change',compactLabel);
  compactLabel();
  const qty = document.createElement('select');
  qty.className = 'qty-select';
  qty.setAttribute('aria-label','数量');
  for(let n=1;n<=40;n++)qty.appendChild(new Option(n+'個',String(n)));
  const remove = document.createElement('button');
  remove.type='button';remove.className='bulk-picker-remove';remove.textContent='×';
  remove.setAttribute('aria-label','この商品を削除');
  remove.onclick=()=>{if(list.children.length>1)row.remove();else {product.value='';qty.value='1';}updateCalc();};
  product.addEventListener('change',updateCalc);
  qty.addEventListener('change',updateCalc);
  row.append(product,qty,remove);
  list.appendChild(row);
  updateCalc();
}

function togglePaymentFields() {
  const method = document.getElementById('paymentMethod').value;
  const pwGroup = document.getElementById('eservicePwGroup');
  const ptGroup = document.getElementById('ninaPointGroup');
  const pwInput = document.getElementById('eservicePw');
  const ptInput = document.getElementById('ninaPoint');

  if (!pwGroup || !ptGroup) return;

  if (method === '現金' || method === 'PayPay') {
    pwGroup.style.display = 'none';
    ptGroup.style.display = 'none';
    if (pwInput) pwInput.value = '';
    if (ptInput) ptInput.value = '';
  } else if (method === 'クレジットカード') {
    pwGroup.style.display = 'block';
    ptGroup.style.display = 'none';
    if (ptInput) ptInput.value = '';
  } else if (method === 'ニナファームカード') {
    pwGroup.style.display = 'block';
    ptGroup.style.display = 'block';
  }
  updateCalc();
}

function updateCalc() {
  const month = document.getElementById('month').value;
  const selects = document.querySelectorAll('.qty-select');
  
  currentSubtotal = 0;
  currentGrandPt = 0;
  currentItemsData = [];

  currentMaster.products.forEach((prod, index) => {
    const cell = document.getElementById(`pt-cell-${index}`);
    if (cell) {
      if (month && prod.pts && prod.pts[month] !== undefined) {
        cell.textContent = prod.pts[month].toLocaleString() + "pt";
      } else {
        cell.textContent = "-";
      }
    }
  });

  selects.forEach(sel => {
    const qty = parseInt(sel.value) || 0;
    if (qty > 0) {
      const index = sel.closest('.bulk-picker-row')?.querySelector('.item-select')?.value;
      if (index === '' || index === undefined) return;
      const prod = currentMaster.products[index];
      const itemPrice = prod.price * qty;
      let itemPt = (month && prod.pts && prod.pts[month]) ? prod.pts[month] * qty : 0;

      currentSubtotal += itemPrice;
      currentGrandPt += itemPt;

      currentItemsData.push({
        product: prod.name,
        quantity: qty,
        price: itemPrice,
        pt: itemPt
      });
    }
  });

  const method = document.getElementById('paymentMethod').value;
  let usedPt = 0;
  if (method === 'ニナファームカード') {
    usedPt = parseInt(document.getElementById('ninaPoint').value) || 0;
  }

  currentGrandTotal = Math.max(0, currentSubtotal - usedPt);

  document.getElementById('displaySubtotal').textContent = "¥" + currentSubtotal.toLocaleString();
  document.getElementById('displayPrice').textContent = "¥" + currentGrandTotal.toLocaleString();
  document.getElementById('displayPt').textContent = currentGrandPt.toLocaleString() + "PT";
}

function addOrderToList() {
  if (currentItemsData.length === 0) {
    alert("数量が選択されている商品がありません。1点以上選択してください。");
    return;
  }

  const month = document.getElementById('month').value;
  const memberIdMain = document.getElementById('memberIdMain').value.trim();
  const memberIdSub = document.getElementById('memberIdSub').value;
  const fullName = document.getElementById('fullName').value.trim();

  if (!month || !memberIdMain || !fullName) {
    alert("発注月度、会員番号、氏名は必須項目です。");
    return;
  }

  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const generatedOrderId = `${yy}${mm}${dd}-${randomStr}`;

  allOrders.push({
    orderId: generatedOrderId,
    month,
    memberId: memberIdMain + "-" + memberIdSub,
    fullName,
    items: [...currentItemsData],
    subtotalPrice: currentSubtotal,
    totalPrice: currentGrandTotal,
    totalPt: currentGrandPt
  });

  // フォームの入力項目を完全に初期化（次の方の入力準備）
  document.getElementById("productPickerRows").replaceChildren();
  addBulkProductPicker();
  document.getElementById('memberIdMain').value = "";
  document.getElementById("memberIdSub").selectedIndex = 0;
  // 氏名・決済方法・E-Service PW・領収書は同じ画面内で引き継ぐ。
  document.getElementById('presetMemberSelect').value = "";
  // 同じお届け先への続けての注文に備え、配送先の入力値は維持する。
  updateCalc();

  renderOrderList();
  const notice = document.getElementById('bulkOrderAddedNotice');
  if (notice) notice.textContent = `${allOrders.length}人目の注文を追加しました。別の会員の注文も続けて追加できます。`;

  document.getElementById("orderListContainer").scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderOrderList() {
  const container = document.getElementById('orderListContainer');
  const listDiv = document.getElementById('addedOrdersList');
  
  const nextButton = document.getElementById("bulkGoPayment");
  if (nextButton) nextButton.classList.toggle("display-none", allOrders.length === 0);
  const addButton = document.getElementById('bulkFooterAdd');
  const hint = document.getElementById('bulkFlowHint');
  if (hint) hint.textContent = allOrders.length ? allOrders.length + '件確定済み。次の会員を入力するか、お支払いへ進んでください' : '会員情報と商品を入力してください';
  updateBulkConfirmState();
  if (allOrders.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  document.getElementById('orderCount').textContent = allOrders.length;


  let html = "";
  allOrders.forEach((ord, i) => {
    let ptNote = '';
    let receiptNote = '';
    html += `
      <div class="bulk-added-order">
        <div class="bulk-added-order-content">
          <div class="bulk-added-order-name"><strong>${i + 1}. ${ord.fullName}</strong><span class="bulk-added-order-member">${ord.memberId}</span></div>
          <div class="bulk-added-order-meta"><span>決済は次の画面で指定</span>${receiptNote ? `<span>${receiptNote.replace(/^ \/ /, '')}</span>` : ''}</div>
          <div class="bulk-added-order-total">支払額 <strong>¥${ord.totalPrice.toLocaleString()}</strong><span>${ord.totalPt.toLocaleString()}pt</span>${ptNote ? `<span>${ptNote}</span>` : ''}</div>
        </div>
        <button type="button" class="bulk-added-order-delete" onclick="removeOrder(${i})">削除</button>
      </div>
    `;
  });
  listDiv.innerHTML = html;
  const grandPrice = allOrders.reduce((sum, ord) => sum + ord.totalPrice, 0);
  const grandPt = allOrders.reduce((sum, ord) => sum + ord.totalPt, 0);
  const grand = document.getElementById('bulkOrdersGrandTotal');
  if (grand) grand.textContent = `全体の合計 ¥${grandPrice.toLocaleString()}（${grandPt.toLocaleString()}PT）`;
}

function removeOrder(index) {
  allOrders.splice(index, 1);
  renderOrderList();
}

function updateBulkConfirmState() {
  const button = document.getElementById('bulkFooterAdd');
  if (!button) return;
  const ready = Boolean(document.getElementById('month')?.value &&
    document.getElementById('memberIdMain')?.value.trim() &&
    document.getElementById('fullName')?.value.trim() &&
    currentItemsData.length);
  button.disabled = !ready;
}
document.addEventListener('input', updateBulkConfirmState);
document.addEventListener('change', updateBulkConfirmState);
function goToBulkPayment() {
  if (!allOrders.length) return;
  // 氏名は次の会員のために保持する仕様なので、未確定注文の判定には使わない。
  const pending = Boolean(document.getElementById('memberIdMain')?.value.trim() || currentItemsData.length);
  if (pending && !confirm('入力途中の会員注文は確定されていません。このままお支払いへ進みますか？')) return;
  document.body.classList.add('bulk-final-step');
  document.getElementById('bulkFinalStage').classList.remove('display-none');
  window.scrollTo(0,0);
}
function backToBulkOrders() {
  document.body.classList.remove('bulk-final-step');
  document.getElementById('bulkFinalStage').classList.add('display-none');
  window.scrollTo(0,0);
}

function resetBulkPayment() {
  document.getElementById('paymentMethod').value = '現金';
  document.getElementById('eservicePw').value = '';
  document.getElementById('ninaPoint').value = '';
  document.getElementById('receiptName').value = '';
  togglePaymentFields();
  updateCalc();
}

function generateAllReceipts() {
  if (!allOrders.length) return;
  const wrapper = document.getElementById('receiptsWrapper');
  wrapper.replaceChildren();
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const yen = value => '¥' + Number(value || 0).toLocaleString();
  const month = allOrders[0].month;
  const paymentMethod = document.getElementById("paymentMethod").value;
  const eservicePw = document.getElementById("eservicePw").value.trim();
  const receiptName = document.getElementById("receiptName").value.trim();
  const ninaPoint = paymentMethod === "ニナファームカード" ? Math.max(0,Number(document.getElementById("ninaPoint").value)||0) : 0;
  const shipName = document.getElementById('shipName').value.trim();
  const zip = document.getElementById('zip').value.trim();
  const address = document.getElementById('address').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const addressRows = [
    shipName ? '宛名：' + escapeText(shipName) : '',
    zip ? '〒' + escapeText(zip) : '',
    address ? escapeText(address) : '',
    phone ? 'TEL：' + escapeText(phone) : ''
  ].filter(Boolean).join('<br>');
  const memberRows = allOrders.map((ord, index) => {
    const items = ord.items.map(item => `<tr><td>${escapeText(item.product)}</td><td>${Number(item.quantity).toLocaleString()}</td><td>${yen(item.price)}</td><td>${Number(item.pt || 0).toLocaleString()}pt</td></tr>`).join('');

    return `<section class="bulk-combined-member">
      <div class="bulk-combined-member-head"><span>${index + 1}. ${escapeText(ord.fullName)}</span><span>会員番号 ${escapeText(ord.memberId)}</span></div>
      <table class="bulk-combined-table" style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th>商品名</th><th>個数</th><th>値段</th><th>ポイント</th></tr></thead><tbody>${items}</tbody></table>
      <div class="bulk-combined-member-total">合計 ${yen(ord.totalPrice)}（${ord.totalPt.toLocaleString()}PT）</div>
    </section>`;
  }).join('');
  const beforeDiscount = allOrders.reduce((sum, ord) => sum + ord.totalPrice, 0);
  const totalPrice = Math.max(0,beforeDiscount - ninaPoint);
  const paymentRows = [
    ["お支払い方法", escapeText(paymentMethod)],
    ["E-Service PW", escapeText(eservicePw), (paymentMethod === "ニナファームカード" || paymentMethod === "クレジットカード") && !!eservicePw],
    ["ニナポイント値引き", "-" + yen(ninaPoint), ninaPoint > 0],
    ["領収書の宛名", escapeText(receiptName), !!receiptName]
  ].filter(row => row.length < 3 || row[2]).map(row => `<div class="bulk-combined-info-row${row[0] === "領収書の宛名" ? " bulk-receipt-name" : ""}"><span>${row[0]}</span><strong>${row[1]}</strong></div>`).join("");
  const totalPt = allOrders.reduce((sum, ord) => sum + ord.totalPt, 0);
  const card = document.createElement('div');
  card.className = 'card-wrapper';
  card.innerHTML = `<div id="card-target-combined" class="receipt-box target-card order-image-sheet">
    <div class="order-image-heading"><div><span class="order-image-kicker">プラッスドゥニナ 南熊本店</span><h3>商品購入注文書</h3></div><div class="order-image-date">発注月度：<strong>${escapeText(month)}</strong><br>${allOrders.length}件の会員注文</div></div>
    <section class="order-image-section"><h4>お支払い情報（全会員共通）</h4><div class="bulk-combined-info">${paymentRows}</div></section>
    ${addressRows ? `<section class="order-image-section"><h4>共通のお届け先</h4><div class="order-image-members">${addressRows}</div></section>` : ''}
    <section class="order-image-section"><h4>会員ごとの注文</h4>${memberRows}</section>
    <div class="bulk-combined-summary"><span>総合計 ${yen(totalPrice)}（${totalPt.toLocaleString()}PT）</span></div>
  </div><button type="button" class="btn-card-download" onclick="downloadSingleCard('card-target-combined')">注文書を画像で保存</button><button type="button" class="bulk-pdf-download" onclick="downloadAllPDF()">PDFで保存</button>`;
  wrapper.appendChild(card);
  document.getElementById('formSection').style.display = 'none';
  document.querySelector('.footer-bar').style.display = 'none';
  document.getElementById('completeSection').classList.remove('display-none');
  document.getElementById('completeSection').style.display = 'block';
  window.scrollTo(0, 0);
}

function reviseBulkOrder() {
  document.getElementById('completeSection').style.display = 'none';
  document.getElementById('completeSection').classList.add('display-none');
  document.getElementById('formSection').style.display = '';
  document.body.classList.add('bulk-final-step');
  document.getElementById('bulkFinalStage').classList.remove('display-none');
  document.getElementById('receiptsWrapper').replaceChildren();
  window.scrollTo(0, 0);
}
function closeModal(modalElement) {
  document.body.style.overflow = ''; // 背景固定解除
  modalElement.remove();
}

async function downloadSingleCard(elementId) {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) return;

  const btn = (typeof event !== 'undefined' && event) ? event.currentTarget : null;
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = "⌛ 画像を生成中...";
    btn.disabled = true;
  }

  try {
    const canvas = await html2canvas(targetElement, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const isLine = /Line/i.test(ua);

    if (isMobile) {
      document.body.style.overflow = 'hidden'; // 背景固定

      const modal = document.createElement('div');
      modal.className = 'image-modal-overlay';
      
      let lineWarningText = "";
      if (isLine) {
        lineWarningText = `
          <div class="android-warning-box" style="margin: 10px auto; max-width: 90%; padding: 8px 12px; background-color: #fff3cd; color: #856404; border: 1.0px solid #ffeeba; border-radius: 6px; font-size: 0.78rem; text-align: left; line-height: 1.4;">
            ⚠️ <strong>LINEなどのアプリ内ブラウザでお使いの場合</strong><br>
            画像の長押し保存が動かない場合があります。その場合は右上的なメニュー「⋮」または「Share」ボタンから<strong>『他のブラウザ（Safari/Chrome）で開く』</strong>をお試しください。
          </div>
        `;
      }

      modal.innerHTML = `
        <div class="image-modal-instruction" style="text-align: center; margin-bottom: 12px; line-height: 1.6;">
          📱 <strong>注文書画像が作成されました！</strong><br>
          <div style="font-size: 0.85rem; margin-top: 6px; background-color: rgba(255, 255, 255, 0.1); padding: 8px; border-radius: 6px;">
            <strong>【保存・送信手順】</strong><br>
            ① 下の画像を<span style="color: var(--gold-light); font-size: 1.05em; font-weight: bold;">「長押し」</span>して端末に保存<br>
            ② LINEを開き<strong>「ニナファーム南熊本サロン」</strong>宛てに画像を送信してください
          </div>
        </div>
        
        <img src="${imgData}" class="image-modal-content" alt="注文書画像">
        ${lineWarningText}

        <button type="button" class="image-modal-close" style="margin-top: 14px;" onclick="closeModal(this.parentElement)">✕ 閉じる</button>
      `;
      document.body.appendChild(modal);
    } else {
      const link = document.createElement('a');
      link.href = imgData;
      const now = new Date();
      const timeStr = now.getFullYear() + String(now.getMonth()+1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + "_" + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      link.download = `注文書_${timeStr}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (e) {
    alert("画像の生成に失敗しました: " + e.message);
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

async function downloadAllPDF() {
  const cards = document.querySelectorAll('.target-card');
  const { jsPDF } = window.jspdf;
  let pdf = null;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const canvas = await html2canvas(card, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    if (i === 0) {
      pdf = new jsPDF('p', 'mm', 'a4');
    } else {
      pdf.addPage();
    }

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
  }

  if (pdf) {
    pdf.save("注文書_まとめ一括.pdf");
  }
}

function clearSavedInfo() {
  if (confirm("端末に保存されている情報を削除しますか？")) {
    try {
      localStorage.removeItem('salonOrderUserInfo');
    } catch (e) {}
    alert("削除しました。");
  }
}
