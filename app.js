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
      safeSetStorage('salonOrderMasterConfig', currentMaster);
    }
  } catch (e) {
    // ② ネットワークオフライン等で取得できなかった場合は過去のキャッシュを利用
    const savedConfig = safeGetStorage('salonOrderMasterConfig', null);
    if (savedConfig) currentMaster = savedConfig;
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
  if (!regSub) return;
  regSub.innerHTML = '';
  for (let i = 0; i <= 20; i++) {
    const opt = document.createElement('option');
    const val = String(i).padStart(2, '0');
    opt.value = val;
    opt.textContent = val;
    regSub.appendChild(opt);
  }
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
  let list = safeGetStorage('salonOrderPresetMembers', []);
  
  const existIdx = list.findIndex(m => m.id === fullId);
  if (existIdx >= 0) {
    list[existIdx].name = name;
  } else {
    list.push({ id: fullId, mainId, subId, name });
  }

  safeSetStorage('salonOrderPresetMembers', list);
  alert(`「${name} (${fullId})」様を登録しました。`);

  document.getElementById('regMemberIdMain').value = '';
  document.getElementById('regFullName').value = '';
  renderPresetMemberList();
}

// 登録済みリストの描画 ＆ プルダウン更新
function renderPresetMemberList() {
  const list = safeGetStorage('salonOrderPresetMembers', []);
  
  const listContainer = document.getElementById('registeredMembersList');
  if (listContainer) {
    if (list.length === 0) {
      listContainer.innerHTML = '<div style="color:var(--text-sub);">※登録されている会員情報はありません。</div>';
    } else {
      let html = '<div style="font-weight:bold; margin-bottom:4px;">【登録済み会員一覧】</div>';
      list.forEach((m, idx) => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0; border-bottom: 1px dashed var(--border-color);">
            <span><strong>${m.name}</strong> (${m.id})</span>
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
      opt.textContent = `${m.name} (${m.id})`;
      select.appendChild(opt);
    });
  }
}

// 登録情報の削除
function deletePresetMember(index) {
  let list = safeGetStorage('salonOrderPresetMembers', []);
  list.splice(index, 1);
  safeSetStorage('salonOrderPresetMembers', list);
  renderPresetMemberList();
}

// フォームへの自動入力反映
function applyPresetMember(index) {
  if (index === "") return;
  const list = safeGetStorage('salonOrderPresetMembers', []);
  const target = list[index];
  if (target) {
    document.getElementById('memberIdMain').value = target.mainId;
    document.getElementById('memberIdSub').value = target.subId;
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

  // 商品テーブル描画
  const tbody = document.getElementById('productTableBody');
  tbody.innerHTML = '';

  currentMaster.products.forEach((prod, index) => {
    const tr = document.createElement('tr');
    let qtyOptions = '<option value="0">0</option>';
    for (let i = 1; i <= 20; i++) {
      qtyOptions += `<option value="${i}">${i}</option>`;
    }

    tr.innerHTML = `
      <td><strong>${prod.name}</strong></td>
      <td style="color: var(--text-sub); text-align: right;">¥${prod.price.toLocaleString()}</td>
      <td class="pt-col" id="pt-cell-${index}">-</td>
      <td class="qty-col">
        <select class="qty-select" data-index="${index}">
          ${qtyOptions}
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.qty-select').forEach(sel => sel.addEventListener('change', updateCalc));
  document.getElementById('month').addEventListener('change', updateCalc);

  togglePaymentFields();
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
      const index = sel.getAttribute('data-index');
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
  document.getElementById('displayPt').textContent = currentGrandPt.toLocaleString() + "pt";
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

  const paymentMethod = document.getElementById('paymentMethod').value;
  const receiptName = document.getElementById('receiptName').value.trim();
  const eservicePw = document.getElementById('eservicePw').value.trim();
  const ninaPoint = parseInt(document.getElementById('ninaPoint').value) || 0;

  const shipName = document.getElementById('shipName').value.trim();
  const zip = document.getElementById('zip').value.trim();
  const address = document.getElementById('address').value.trim();
  const phone = document.getElementById('phone').value.trim();

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
    paymentMethod,
    receiptName,
    eservicePw: (paymentMethod === 'ニナファームカード' || paymentMethod === 'クレジットカード') ? eservicePw : '',
    ninaPoint: paymentMethod === 'ニナファームカード' ? ninaPoint : 0,
    shipName, zip, address, phone,
    items: [...currentItemsData],
    subtotalPrice: currentSubtotal,
    totalPrice: currentGrandTotal,
    totalPt: currentGrandPt
  });

  // フォームの入力項目を完全に初期化（次の方の入力準備）
  document.querySelectorAll('.qty-select').forEach(sel => sel.value = "0");
  document.getElementById('memberIdMain').value = "";
  document.getElementById('fullName').value = "";
  document.getElementById('paymentMethod').value = "現金";
  togglePaymentFields(); // 支払い入力エリアを非表示・リセット
  document.getElementById('receiptName').value = "";
  document.getElementById('presetMemberSelect').value = "";
  document.getElementById('shipName').value = "";
  document.getElementById('zip').value = "";
  document.getElementById('address').value = "";
  document.getElementById('phone').value = "";
  updateCalc();

  renderOrderList();

  // 追加済みリストの位置へスムーズに自動スクロール
  const container = document.getElementById('orderListContainer');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderOrderList() {
  const container = document.getElementById('orderListContainer');
  const listDiv = document.getElementById('addedOrdersList');
  const badge = document.getElementById('footerOrderBadge');
  
  if (allOrders.length === 0) {
    container.style.display = "none";
    if (badge) badge.style.display = "none";
    return;
  }

  container.style.display = "block";
  document.getElementById('orderCount').textContent = allOrders.length;

  if (badge) {
    badge.style.display = "inline-block";
    badge.textContent = `📋 追加済み: ${allOrders.length}件`;
  }

  let html = "";
  allOrders.forEach((ord, i) => {
    let ptNote = ord.ninaPoint > 0 ? ` (ポイント利用 -¥${ord.ninaPoint.toLocaleString()})` : '';
    let receiptNote = ord.receiptName ? ` / 領収書: ${ord.receiptName}` : '';
    html += `
      <div style="border-bottom: 1px dashed var(--border-color); padding: 8px 0; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${i + 1}. ${ord.fullName}</strong> (${ord.memberId}) <small style="color:var(--text-sub);">[ID: ${ord.orderId}]</small> - <span style="color:var(--wood-medium); font-weight:bold;">${ord.paymentMethod}</span>${receiptNote}<br>
          <small style="color: var(--text-sub);">支払額: ¥${ord.totalPrice.toLocaleString()}${ptNote} / ${ord.totalPt.toLocaleString()}pt</small>
        </div>
        <button type="button" onclick="removeOrder(${i})" style="color: #c94b4b; border: none; background: none; cursor: pointer; font-size: 0.75rem; font-weight: bold;">削除</button>
      </div>
    `;
  });
  listDiv.innerHTML = html;
}

function removeOrder(index) {
  allOrders.splice(index, 1);
  renderOrderList();
}

function generateAllReceipts() {
  if (allOrders.length === 0) return;

  const wrapper = document.getElementById('receiptsWrapper');
  wrapper.innerHTML = "";

  const now = new Date();
  const dateStr = "作成日時: " + now.getFullYear() + "/" + (now.getMonth()+1) + "/" + now.getDate() + " " + now.getHours() + ":" + String(now.getMinutes()).padStart(2, '0');

  allOrders.forEach((ord, index) => {
    const orderId = ord.orderId;
    
    let totalQty = 0;
    let itemRows = "";
    ord.items.forEach(item => {
      totalQty += item.quantity;
      itemRows += `
        <tr>
          <td><strong>${item.product}</strong></td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">¥${item.price.toLocaleString()}</td>
          <td style="text-align: right; color: var(--wood-medium);">${item.pt ? item.pt.toLocaleString() + 'pt' : '-'}</td>
        </tr>
      `;
    });

    let paymentInfoBlock = `<div>お支払い方法: <strong>${ord.paymentMethod}</strong></div>`;
    if (ord.receiptName) {
      paymentInfoBlock += `<div>領収書宛名: <strong>${ord.receiptName}</strong></div>`;
    }
    if (ord.paymentMethod === 'ニナファームカード' || ord.paymentMethod === 'クレジットカード') {
      if (ord.eservicePw) {
        paymentInfoBlock += `<div>E-Service PW: <strong>${ord.eservicePw}</strong></div>`;
      }
    }
    if (ord.paymentMethod === 'ニナファームカード' && ord.ninaPoint > 0) {
      paymentInfoBlock += `<div>ニナポイント利用: <strong>${ord.ninaPoint.toLocaleString()} pt (-¥${ord.ninaPoint.toLocaleString()})</strong></div>`;
    }

    let addressBlock = "";
    if (ord.shipName || ord.address || ord.zip || ord.phone) {
      addressBlock = `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color);">
          <div style="font-weight: bold; color: var(--wood-medium); margin-bottom: 2px;">【お届け先情報】</div>
          <div>${ord.shipName ? "お名前: " + ord.shipName : "お名前: " + ord.fullName}</div>
          <div>${ord.zip ? "〒" + ord.zip : ""}</div>
          <div>${ord.address ? "住所: " + ord.address : ""}</div>
          <div>${ord.phone ? "TEL: " + ord.phone : ""}</div>
        </div>
      `;
    }

    let totalBlock = "";
    if (ord.ninaPoint > 0) {
      totalBlock = `
        <div style="display: flex; justify-content: space-between; color: var(--text-sub); font-size: 0.78rem;">
          <span>小計金額:</span>
          <span>¥${ord.subtotalPrice.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #c94b4b; font-size: 0.78rem;">
          <span>ニナポイント値引き:</span>
          <span>-¥${ord.ninaPoint.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;">
          <span>お支払い合計金額:</span>
          <span style="color: #c94b4b; font-size: 1rem;">¥${ord.totalPrice.toLocaleString()}</span>
        </div>
      `;
    } else {
      totalBlock = `
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>合計金額:</span>
          <span style="color: #c94b4b;">¥${ord.totalPrice.toLocaleString()}</span>
        </div>
      `;
    }

    const cardWrapper = document.createElement('div');
    cardWrapper.className = "card-wrapper";
    cardWrapper.innerHTML = `
      <div id="card-target-${index}" class="receipt-box target-card">
        <div class="receipt-header">
          <h3 style="margin: 0; font-size: 1rem; color: var(--wood-dark);">南熊本サロン専用商品購入注文書</h3>
          <div class="order-id-badge">発注ID: ${orderId}</div>
          <p style="margin: 5px 0 0 0; font-size: 0.72rem; color: var(--text-sub);">${dateStr}</p>
        </div>
        <div class="receipt-info">
          <div>発注月度: <strong>${ord.month}</strong></div>
          <div>購入会員番号: <strong>${ord.memberId}</strong></div>
          <div>氏名: <strong>${ord.fullName}</strong></div>
          ${paymentInfoBlock}
          ${addressBlock}
        </div>
        <table class="product-table" style="margin-bottom: 15px;">
          <thead>
            <tr>
              <th>商品名</th>
              <th style="width: 35px; text-align: center;">数量</th>
              <th style="width: 70px; text-align: right;">小計(税込)</th>
              <th style="width: 55px; text-align: right;">ポイント</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="border-top: 2px dashed var(--accent-gold); padding-top: 10px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--wood-dark); margin-bottom: 4px;">
            <span>合計数量:</span>
            <span>${totalQty} 点</span>
          </div>
          ${totalBlock}
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;">
            <span>獲得ポイント:</span>
            <span style="color: var(--wood-medium);">${ord.totalPt.toLocaleString()}pt</span>
          </div>
        </div>
      </div>
      <button type="button" class="btn-card-download" onclick="downloadSingleCard('card-target-${index}')">
        📷 この注文書（${ord.fullName}様分）を画像保存
      </button>
    `;
    wrapper.appendChild(cardWrapper);
  });

  const summaryItems = {};
  let totalAllSubtotal = 0;
  let totalAllNinaPoint = 0;
  let totalAllPayPrice = 0;
  let totalAllPt = 0;
  let grandTotalQty = 0;

  allOrders.forEach(ord => {
    totalAllSubtotal += ord.subtotalPrice;
    totalAllNinaPoint += ord.ninaPoint;
    totalAllPayPrice += ord.totalPrice;
    totalAllPt += ord.totalPt;

    ord.items.forEach(item => {
      grandTotalQty += item.quantity;
      if (!summaryItems[item.product]) {
        summaryItems[item.product] = { quantity: 0, price: 0, pt: 0 };
      }
      summaryItems[item.product].quantity += item.quantity;
      summaryItems[item.product].price += item.price;
      summaryItems[item.product].pt += (item.pt || 0);
    });
  });

  let summaryRows = "";
  for (let prod in summaryItems) {
    summaryRows += `
      <tr>
        <td><strong>${prod}</strong></td>
        <td style="text-align: center;">${summaryItems[prod].quantity}</td>
        <td style="text-align: right;">¥${summaryItems[prod].price.toLocaleString()}</td>
        <td style="text-align: right; color: var(--wood-medium);">${summaryItems[prod].pt ? summaryItems[prod].pt.toLocaleString() + 'pt' : '-'}</td>
      </tr>
    `;
  }

  let summaryTotalBlock = "";
  if (totalAllNinaPoint > 0) {
    summaryTotalBlock = `
      <div style="display: flex; justify-content: space-between; color: var(--text-sub); font-size: 0.78rem;">
        <span>全商品 定価総額:</span>
        <span>¥${totalAllSubtotal.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: #c94b4b; font-size: 0.78rem;">
        <span>ニナポイント利用総額:</span>
        <span>-¥${totalAllNinaPoint.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;">
        <span>全合算 実際の支払総合計:</span>
        <span style="color: #c94b4b; font-size: 1.05rem;">¥${totalAllPayPrice.toLocaleString()}</span>
      </div>
    `;
  } else {
    summaryTotalBlock = `
      <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>全合算 総合計金額:</span>
        <span style="color: #c94b4b; font-size: 1.05rem;">¥${totalAllPayPrice.toLocaleString()}</span>
      </div>
    `;
  }

  const summaryWrapper = document.createElement('div');
  summaryWrapper.className = "card-wrapper";
  summaryWrapper.innerHTML = `
    <div id="card-target-summary" class="receipt-box target-card">
      <div class="receipt-header">
        <h3 style="margin: 0; font-size: 1rem; color: var(--wood-dark);">【全体合算】注文集計まとめ</h3>
        <p style="margin: 5px 0 0 0; font-size: 0.72rem; color: var(--text-sub);">対象注文数: ${allOrders.length} 件 | ${dateStr}</p>
      </div>
      <div style="font-size: 0.75rem; margin-bottom: 12px; background-color: #f7f3eb; padding: 10px; border-radius: 6px; border: 1.0px solid var(--border-color);">
        <strong>対象会員一覧:</strong><br>
        ${allOrders.map(o => `${o.fullName} 様 (${o.memberId}) [ID: ${o.orderId}]`).join('<br>')}
      </div>
      <table class="product-table" style="margin-bottom: 15px;">
        <thead>
          <tr>
            <th>商品名（全体合計）</th>
            <th style="width: 45px; text-align: center;">総数量</th>
            <th style="width: 75px; text-align: right;">総合計(税込)</th>
            <th style="width: 60px; text-align: right;">総ポイント</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>
      <div style="border-top: 2.0px solid var(--accent-gold); padding-top: 10px; font-size: 0.88rem;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--wood-dark); margin-bottom: 4px;">
          <span>全合算 総数量:</span>
          <span>${grandTotalQty} 点</span>
        </div>
        ${summaryTotalBlock}
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;">
          <span>全合算 総獲得ポイント:</span>
          <span style="color: var(--wood-medium);">${totalAllPt.toLocaleString()}pt</span>
        </div>
      </div>
    </div>
    <button type="button" class="btn-card-download" style="background-color: var(--wood-dark); color: var(--gold-light);" onclick="downloadSingleCard('card-target-summary')">
      📊 「全体まとめ」を画像保存
    </button>
  `;
  wrapper.appendChild(summaryWrapper);

  document.getElementById('formSection').style.display = "none";
  document.querySelector('.footer-bar').style.display = "none";
  document.getElementById('completeSection').style.display = "block";
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
