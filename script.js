  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  const SUPABASE_URL = 'https://ghyaoezeeecfxizegqov.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoeWFvZXplZWVjZnhpemVncW92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDA3OTMsImV4cCI6MjEwMDM3Njc5M30.5tFudWfakxruQ6sVbHiIHuuQue7kxkciEykbPEZVuKI'
  const PHOTO_BUCKET = 'member-photos'

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const BOARD_LABELS = { vboost: 'V-BOOST', ts: 'T&S' }
  const BOARD_LEVEL_COUNTS = { vboost: 10, ts: 12 }
  
  function levelsFor(board) {
    const n = BOARD_LEVEL_COUNTS[board]
    return Array.from({ length: n }, (_, i) => n - i) // highest down to 1
  }
  
  const getVisibleSlots = () => window.innerWidth <= 768 ? 3 : 5;
  const CARD_GAP = 14 // px between photos — must match the .photo-carousel CSS gap

  let currentBoard = 'vboost'
  let allMembers = []         // every member row, both boards — filtered per board at render time
  let membersByLevel = {}     // { level: [member, ...] } newest first, for the currently shown board
  let activeBoard = null      // board the add-member modal is currently open for
  let activeLevel = null

  const levelListEl = document.getElementById('levelList')
  const headerSub = document.getElementById('headerSub')
  const boardTabs = document.getElementById('boardTabs')

  boardTabs.querySelectorAll('.board-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.board === currentBoard) return
      currentBoard = tab.dataset.board
      render()
    })
  })

  let lastMembersSignature = null
  function membersSignature(rows) {
    return rows.map((r) => `${r.id}:${r.board}:${r.level}:${r.name}:${r.district}:${r.photo_url}`).sort().join('|')
  }

  async function loadMembers() {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load members:', error)
      allMembers = []
      render()
      headerSub.textContent = `Couldn't load members — ${error.message || 'check your Supabase setup'}`
      return
    }

    // Skip the re-render (and the image reload/flicker that comes with it) when the
    // periodic poll or a realtime event fires but nothing has actually changed.
    const sig = membersSignature(data)
    if (sig === lastMembersSignature) return
    lastMembersSignature = sig

    allMembers = data
    render()
  }

const boardLabel = document.getElementById("boardLabel");

document.querySelectorAll(".board-tab").forEach(button => {
    button.addEventListener("click", () => {

        document.querySelectorAll(".board-tab")
            .forEach(btn => btn.classList.remove("active"));

        button.classList.add("active");

        if (button.dataset.board === "vboost") {
            boardLabel.textContent = "Members in V-BOOST";
        } else {
            boardLabel.textContent = "Members in T&S";
        }
    });
});

  function render() {
    boardTabs.querySelectorAll('.board-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.board === currentBoard)
    })

    const LEVELS = levelsFor(currentBoard)
    membersByLevel = {}
    for (const row of allMembers) {
      if (row.board !== currentBoard) continue
      if (!membersByLevel[row.level]) membersByLevel[row.level] = []
      membersByLevel[row.level].push(row)
    }
    headerSub.textContent = `${BOARD_LABELS[currentBoard]} — ${LEVELS.length} levels`

    levelListEl.innerHTML = ''
    for (const level of LEVELS) {
      const levelMembers = membersByLevel[level] || [] // newest first — newest sits leftmost

      const padded = levelMembers.length
        ? [...levelMembers, ...Array(Math.max(0, getVisibleSlots() - levelMembers.length)).fill(null)]
        : []

      const row = document.createElement('div')
      row.className = 'level-row'

      row.innerHTML = `
        <div class="level-tag">Level ${level}</div>
        <div class="level-rule"></div>
        <div class="carousel-wrap">
          <div class="photo-carousel" data-level="${level}">
            ${padded.length ? padded.map((m) => m ? `
              <div class="photo-card">
                <img class="photo-square" src="${escapeHtml(m.photo_url)}" alt="${escapeHtml(m.name)}" />
                <div class="photo-name">${escapeHtml(m.name)}</div>
                ${m.district ? `<div class="photo-district">${escapeHtml(m.district)}</div>` : ''}
              </div>
            ` : `
              <div class="photo-card photo-card--blank">
                <div class="photo-square photo-square--blank"></div>
              </div>
            `).join('') : `<span class="empty-slot">no members yet</span>`}
          </div>
        </div>
        <button class="add-btn" data-level="${level}" aria-label="Add member to level ${level}">+</button>
      `

      levelListEl.appendChild(row)
    }

    // wire up + buttons
    levelListEl.querySelectorAll('.add-btn').forEach((btn) => {
      btn.addEventListener('click', () => openModal(currentBoard, btn.dataset.level))
    })

    // wire up carousels: size to fit 5 photos. Touch swipe and trackpad two-finger
    // scroll both work natively on an overflow-x:auto element — no JS needed for those.
    // The only thing we add is: a plain vertical mouse-wheel also moves the row left/right.
    levelListEl.querySelectorAll('.photo-carousel').forEach((carousel) => {
      sizeCarousel(carousel)

      carousel.addEventListener('wheel', (e) => {
        if (carousel.scrollWidth <= carousel.clientWidth) return // nothing to scroll — let the page handle it
        // A trackpad's two-finger horizontal swipe already arrives as deltaX and the
        // browser scrolls this element natively — leave that alone. Only take over for
        // a vertical mouse-wheel (deltaY-dominant), which has no horizontal meaning otherwise.
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
        e.preventDefault()
        carousel.scrollLeft += e.deltaY
      }, { passive: false })
    })
  }

  function sizeCarousel(carousel) {
    const wrap = carousel.parentElement
    const sidePadding = 12 // matches the carousel's left+right padding
    const usable = wrap.clientWidth - sidePadding - CARD_GAP * (getVisibleSlots() - 1)
    const size = Math.max(40, Math.floor(usable / getVisibleSlots()))
    carousel.style.setProperty('--card-size', size + 'px')
  }

  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  // ---- Country codes: dial code + expected WhatsApp number length per country ----
  const COUNTRY_CODES = [
    { code: '+91',  name: 'India',          flag: '🇮🇳', min: 10, max: 10 },
    { code: '+1',   name: 'USA / Canada',   flag: '🇺🇸', min: 10, max: 10 },
    { code: '+44',  name: 'United Kingdom', flag: '🇬🇧', min: 10, max: 10 },
    { code: '+61',  name: 'Australia',      flag: '🇦🇺', min: 9,  max: 9  },
    { code: '+971', name: 'UAE',            flag: '🇦🇪', min: 9,  max: 9  },
    { code: '+966', name: 'Saudi Arabia',   flag: '🇸🇦', min: 9,  max: 9  },
    { code: '+974', name: 'Qatar',          flag: '🇶🇦', min: 8,  max: 8  },
    { code: '+973', name: 'Bahrain',        flag: '🇧🇭', min: 8,  max: 8  },
    { code: '+965', name: 'Kuwait',         flag: '🇰🇼', min: 8,  max: 8  },
    { code: '+968', name: 'Oman',           flag: '🇴🇲', min: 8,  max: 8  },
    { code: '+65',  name: 'Singapore',      flag: '🇸🇬', min: 8,  max: 8  },
    { code: '+60',  name: 'Malaysia',       flag: '🇲🇾', min: 9,  max: 10 },
    { code: '+92',  name: 'Pakistan',       flag: '🇵🇰', min: 10, max: 10 },
    { code: '+880', name: 'Bangladesh',     flag: '🇧🇩', min: 10, max: 10 },
    { code: '+94',  name: 'Sri Lanka',      flag: '🇱🇰', min: 9,  max: 9  },
    { code: '+977', name: 'Nepal',          flag: '🇳🇵', min: 10, max: 10 },
    { code: '+63',  name: 'Philippines',    flag: '🇵🇭', min: 10, max: 10 },
    { code: '+62',  name: 'Indonesia',      flag: '🇮🇩', min: 9,  max: 12 },
    { code: '+27',  name: 'South Africa',   flag: '🇿🇦', min: 9,  max: 9  },
    { code: '+234', name: 'Nigeria',        flag: '🇳🇬', min: 10, max: 10 },
    { code: '+20',  name: 'Egypt',          flag: '🇪🇬', min: 10, max: 10 },
    { code: '+33',  name: 'France',         flag: '🇫🇷', min: 9,  max: 9  },
    { code: '+49',  name: 'Germany',        flag: '🇩🇪', min: 10, max: 11 },
    { code: '+39',  name: 'Italy',          flag: '🇮🇹', min: 9,  max: 10 },
    { code: '+34',  name: 'Spain',          flag: '🇪🇸', min: 9,  max: 9  },
    { code: '+7',   name: 'Russia',         flag: '🇷🇺', min: 10, max: 10 },
    { code: '+86',  name: 'China',          flag: '🇨🇳', min: 11, max: 11 },
    { code: '+81',  name: 'Japan',          flag: '🇯🇵', min: 10, max: 10 },
    { code: '+82',  name: 'South Korea',    flag: '🇰🇷', min: 9,  max: 10 },
    { code: '+55',  name: 'Brazil',         flag: '🇧🇷', min: 10, max: 11 },
    { code: '+52',  name: 'Mexico',         flag: '🇲🇽', min: 10, max: 10 },
  ]

  // ---- Modal / wizard logic ----
  const modalOverlay = document.getElementById('modalOverlay')
  const modalTitle = document.getElementById('modalTitle')
  const requestForm = document.getElementById('requestForm')
  const nameInput = document.getElementById('nameInput')
  const districtInput = document.getElementById('districtInput')
  const phoneInput = document.getElementById('phoneInput')
  const countryCodeInput = document.getElementById('countryCodeInput')
  const phoneHint = document.getElementById('phoneHint')
  const nftInput = document.getElementById('nftInput')
  const identifierHeading = document.getElementById('identifierHeading')
  const identifierHint = document.getElementById('identifierHint')
  const identifierLabel = document.getElementById('identifierLabel')
  const upgradeNotice = document.getElementById('upgradeNotice')
  const upgradeNoticeText = document.getElementById('upgradeNoticeText')
  const upgradeCancelBtn = document.getElementById('upgradeCancelBtn')
  const upgradeConfirmBtn = document.getElementById('upgradeConfirmBtn')
  const hofPhotoInput = document.getElementById('hofPhotoInput')
  const proofPhotoInput = document.getElementById('proofPhotoInput')
  const bigDrop = document.getElementById('bigDrop')
  const photoPickView = document.getElementById('photoPickView')
  const photoCropView = document.getElementById('photoCropView')
  const choosePhotoAgainBtn = document.getElementById('choosePhotoAgainBtn')
  const proofPhotoPreview = document.getElementById('proofPhotoPreview')
  const proofPhotoLabel = document.getElementById('proofPhotoLabel')
  const namePhotoPreview = document.getElementById('namePhotoPreview')
  const formError = document.getElementById('formError')
  const formSuccess = document.getElementById('formSuccess')
  const submitBtn = document.getElementById('submitBtn')
  const nextBtn = document.getElementById('nextBtn')
  const backBtn = document.getElementById('backBtn')
  const wizardNav = document.getElementById('wizardNav')
  const stepDots = document.getElementById('stepDots')
  const cropFrame = document.getElementById('cropFrame')
  const cropCanvas = document.getElementById('cropCanvas')
  const zoomRange = document.getElementById('zoomRange')

  const TOTAL_STEPS = 6 // 0 photo (pick+crop), 1 name, 2 district, 3 phone, 4 identifier, 5 proof photo
  let currentStep = 0
  let croppedPhotoBlob = null   // final cropped Hall of Fame photo, as a Blob
  let croppedPhotoUrl = null    // object URL for preview
  let isUpgrade = false         // true once the person has confirmed this NFT is an upgrade of an existing member
  let upgradeFromLevel = null   // the level the existing member is currently on, when isUpgrade is true

  // populate country code select
  COUNTRY_CODES.forEach((c, i) => {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = `${c.flag} ${c.code} ${c.name}`
    countryCodeInput.appendChild(opt)
  })

  function currentCountry() {
    return COUNTRY_CODES[Number(countryCodeInput.value)] || COUNTRY_CODES[0]
  }

  function identifierName(board = activeBoard) {
    return board === 'ts' ? 'Link ID' : 'Passport NFT'
  }

  function identifierIsValid(value, board = activeBoard) {
    if (board === 'ts') return /^[A-Za-z0-9]{10}$/.test(value)
    return /^[0-9]{5}$/.test(value)
  }

  function updateIdentifierFields(board) {
    const isTs = board === 'ts'
    const name = identifierName(board)
    identifierHeading.textContent = name
    identifierHint.textContent = isTs
      ? 'Enter the 10-character Link ID using letters and numbers.'
      : 'Enter the 5-digit Passport NFT number.'
    identifierLabel.textContent = isTs ? 'Link ID' : 'Passport NFT number'
    document.getElementById('proofPhotoHint').textContent = `Upload a clear photo that verifies your ${name}.`
    nftInput.placeholder = isTs ? 'e.g. aB12Cd3456' : 'e.g. 04821'
    nftInput.inputMode = isTs ? 'text' : 'numeric'
    nftInput.maxLength = isTs ? 10 : 5
  }

  function updatePhoneHint() {
    const c = currentCountry()
    const lenLabel = c.min === c.max ? `${c.min} digits` : `${c.min}–${c.max} digits`
    phoneHint.textContent = `${c.name} numbers need ${lenLabel}.`
    phoneInput.placeholder = c.min === c.max ? `${c.min} digit number` : `${lenLabel} number`
    phoneInput.maxLength = c.max
  }
  countryCodeInput.addEventListener('change', () => {
    // re-trim in case switching to a shorter country cuts off extra digits
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, currentCountry().max)
    updatePhoneHint()
  })
  phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, currentCountry().max)
  })
  nftInput.addEventListener('input', () => {
    if (activeBoard === 'ts') {
      nftInput.value = nftInput.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)
    } else {
      nftInput.value = nftInput.value.replace(/\D/g, '').slice(0, 5)
    }
  })

  upgradeCancelBtn.addEventListener('click', () => {
    isUpgrade = false
    upgradeFromLevel = null
    upgradeNotice.classList.remove('open')
    nftInput.disabled = false
    nftInput.value = ''
    nftInput.focus()
    nextBtn.style.display = 'block'
  })

  upgradeConfirmBtn.addEventListener('click', () => {
    upgradeNotice.classList.remove('open')
    nftInput.disabled = false
    showStep(5)
  })

  function renderDots() {
    stepDots.innerHTML = ''
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const dot = document.createElement('div')
      dot.className = 'step-dot' + (i < currentStep ? ' done' : i === currentStep ? ' active' : '')
      stepDots.appendChild(dot)
    }
  }

  function showStep(step) {
    currentStep = step
    requestForm.querySelectorAll('.wizard-step').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.step) === step)
    })
    renderDots()
    formError.style.display = 'none'
    backBtn.style.display = step === 0 ? 'none' : 'block'
    const onPhotoPickSubview = step === 0 && !rawImage
    nextBtn.style.display = (step === TOTAL_STEPS - 1 || onPhotoPickSubview) ? 'none' : 'block'
    submitBtn.style.display = step === TOTAL_STEPS - 1 ? 'block' : 'none'
    nextBtn.textContent = step === 0 ? 'OK' : 'Next'
    if (step === 1) namePhotoPreview.src = croppedPhotoUrl || ''
  }

  function showError(msg) {
    formError.textContent = msg
    formError.style.display = 'block'
    formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function resetWizard() {
    requestForm.reset()
    croppedPhotoBlob = null
    if (croppedPhotoUrl) URL.revokeObjectURL(croppedPhotoUrl)
    croppedPhotoUrl = null
    rawImage = null
    photoPickView.style.display = 'block'
    photoCropView.style.display = 'none'
    proofPhotoPreview.style.display = 'none'
    if (proofPhotoPreviewUrl) URL.revokeObjectURL(proofPhotoPreviewUrl)
    proofPhotoPreviewUrl = null
    proofPhotoPreview.removeAttribute('src')
    proofPhotoLabel.style.display = 'block'
    formError.style.display = 'none'
    isUpgrade = false
    upgradeFromLevel = null
    upgradeNotice.classList.remove('open')
    nftInput.disabled = false
    formSuccess.style.display = 'none'
    requestForm.style.display = 'block'
    submitBtn.disabled = false
    countryCodeInput.value = '0' // default India
    updatePhoneHint()
    showStep(0)
  }

  function openModal(board, level) {
    activeBoard = board
    activeLevel = level
    modalTitle.textContent = `Request to add a member — ${BOARD_LABELS[board]} Level ${level}`
    updateIdentifierFields(board)
    resetWizard()
    modalOverlay.classList.add('open')
  }

  function closeModal() {
    modalOverlay.classList.remove('open')
    activeBoard = null
    activeLevel = null
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal()
  })

  document.getElementById('successOkBtn').addEventListener('click', closeModal)

  // ---- Step 0: photo picker -> switches straight into the crop subview ----
  let rawImage = null // HTMLImageElement of the originally chosen file
  const MAX_PHOTO_BYTES = 500 * 1024 // 500 KB
  const MAX_PROOF_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB
  let proofPhotoPreviewUrl = null
  hofPhotoInput.addEventListener('change', () => {
    const file = hofPhotoInput.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      hofPhotoInput.value = ''
      showError('Please choose an image file for the Hall of Fame photo.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showError(`That photo is ${(file.size / 1024).toFixed(0)} KB — please choose one under 100 KB.`)
      hofPhotoInput.value = ''
      return
    }
    const img = new Image()
    img.onload = () => {
      rawImage = img
      photoPickView.style.display = 'none'
      photoCropView.style.display = 'block'
      startCropStage()
      showStep(0) // refresh Back/Next visibility now that rawImage is set
    }
    img.onerror = () => showError('Could not read that image — please try another photo.')
    img.src = URL.createObjectURL(file)
  })

  choosePhotoAgainBtn.addEventListener('click', () => {
    rawImage = null
    hofPhotoInput.value = ''
    photoCropView.style.display = 'none'
    photoPickView.style.display = 'block'
    showStep(0)
  })

  // ---- Step 1: crop / reposition tool ----
  const CROP_SIZE = 260
  const ctx = cropCanvas.getContext('2d')
  let cropState = { baseScale: 1, zoom: 1, offsetX: 0, offsetY: 0 }
  let dragging = false
  let dragStart = { x: 0, y: 0, offX: 0, offY: 0 }

  function startCropStage() {
    if (!rawImage) return
    cropState.baseScale = Math.max(CROP_SIZE / rawImage.width, CROP_SIZE / rawImage.height)
    cropState.zoom = 1
    cropState.offsetX = 0
    cropState.offsetY = 0
    zoomRange.value = 100
    drawCrop()
  }

  function drawCrop() {
    if (!rawImage) return
    const scale = cropState.baseScale * cropState.zoom
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE)
    ctx.save()
    ctx.translate(CROP_SIZE / 2 + cropState.offsetX, CROP_SIZE / 2 + cropState.offsetY)
    ctx.scale(scale, scale)
    ctx.drawImage(rawImage, -rawImage.width / 2, -rawImage.height / 2)
    ctx.restore()
  }

  function clampOffsets() {
    const scale = cropState.baseScale * cropState.zoom
    const halfW = (rawImage.width * scale) / 2
    const halfH = (rawImage.height * scale) / 2
    const maxX = Math.max(0, halfW - CROP_SIZE / 2)
    const maxY = Math.max(0, halfH - CROP_SIZE / 2)
    cropState.offsetX = Math.min(maxX, Math.max(-maxX, cropState.offsetX))
    cropState.offsetY = Math.min(maxY, Math.max(-maxY, cropState.offsetY))
  }

  function pointerPos(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    return { x: e.clientX, y: e.clientY }
  }
  function onDragStart(e) {
    dragging = true
    const p = pointerPos(e)
    dragStart = { x: p.x, y: p.y, offX: cropState.offsetX, offY: cropState.offsetY }
  }
  function onDragMove(e) {
    if (!dragging) return
    const p = pointerPos(e)
    cropState.offsetX = dragStart.offX + (p.x - dragStart.x)
    cropState.offsetY = dragStart.offY + (p.y - dragStart.y)
    clampOffsets()
    drawCrop()
  }
  function onDragEnd() { dragging = false }

  cropFrame.addEventListener('pointerdown', onDragStart)
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  cropFrame.addEventListener('touchstart', onDragStart, { passive: true })
  cropFrame.addEventListener('touchmove', (e) => { onDragMove(e); e.preventDefault() }, { passive: false })
  cropFrame.addEventListener('touchend', onDragEnd)

  zoomRange.addEventListener('input', () => {
    cropState.zoom = Number(zoomRange.value) / 100
    clampOffsets()
    drawCrop()
  })

  function confirmCrop() {
    return new Promise((resolve, reject) => {
      const OUTPUT_SIZE = 480
      const out = document.createElement('canvas')
      out.width = OUTPUT_SIZE
      out.height = OUTPUT_SIZE
      const octx = out.getContext('2d')
      const factor = OUTPUT_SIZE / CROP_SIZE
      const scale = cropState.baseScale * cropState.zoom * factor
      octx.save()
      octx.translate(OUTPUT_SIZE / 2 + cropState.offsetX * factor, OUTPUT_SIZE / 2 + cropState.offsetY * factor)
      octx.scale(scale, scale)
      octx.drawImage(rawImage, -rawImage.width / 2, -rawImage.height / 2)
      octx.restore()
      out.toBlob((blob) => {
        if (!blob) return reject(new Error('Could not process the photo.'))
        resolve(blob)
      }, 'image/jpeg', 0.92)
    })
  }

  // ---- Step 5: proof photo preview ----
  proofPhotoInput.addEventListener('change', () => {
    const file = proofPhotoInput.files[0]
    if (!file) {
      proofPhotoPreview.style.display = 'none'
      proofPhotoLabel.style.display = 'block'
      return
    }
    if (!file.type.startsWith('image/')) {
      proofPhotoInput.value = ''
      proofPhotoPreview.style.display = 'none'
      proofPhotoLabel.style.display = 'block'
      showError('Please choose an image file for the proof photo.')
      return
    }
    if (file.size > MAX_PROOF_PHOTO_BYTES) {
      proofPhotoInput.value = ''
      proofPhotoPreview.style.display = 'none'
      proofPhotoLabel.style.display = 'block'
      showError('Proof photo must be smaller than 5 MB.')
      return
    }
    if (proofPhotoPreviewUrl) URL.revokeObjectURL(proofPhotoPreviewUrl)
    proofPhotoPreviewUrl = URL.createObjectURL(file)
    proofPhotoPreview.src = proofPhotoPreviewUrl
    proofPhotoPreview.style.display = 'block'
    proofPhotoLabel.style.display = 'none'
  })

  // ---- Board-specific identifier duplicate check ----
  // Looks in both the approved members table and the pending requests table so we
  // catch a number that's already on the board AND one that's already waiting for review.
  async function findExistingNft(nft) {
    const { data: memberRows, error: memberErr } = await supabase
      .from('members')
      .select('board, level')
      .eq('passport_nft', nft)
      .limit(1)
    if (memberErr) throw memberErr
    if (memberRows && memberRows.length) return memberRows[0]

    const { data: requestRows, error: reqErr } = await supabase
      .from('requests')
      .select('board, level')
      .eq('passport_nft', nft)
      .limit(1)
    if (reqErr) throw reqErr
    if (requestRows && requestRows.length) return requestRows[0]

    return null
  }

  // ---- Navigation ----
  backBtn.addEventListener('click', () => {
    if (currentStep === 0) return
    showStep(currentStep - 1)
  })

  nextBtn.addEventListener('click', async () => {
    formError.style.display = 'none'

    if (currentStep === 0) {
      // "OK" on the crop subview
      try {
        croppedPhotoBlob = await confirmCrop()
        if (croppedPhotoUrl) URL.revokeObjectURL(croppedPhotoUrl)
        croppedPhotoUrl = URL.createObjectURL(croppedPhotoBlob)
      } catch (err) {
        showError(err.message || 'Could not process the photo.')
        return
      }
      showStep(1)
      return
    }

    if (currentStep === 1) {
      if (!nameInput.value.trim()) { showError('Please enter the full name.'); return }
      showStep(2)
      return
    }

    if (currentStep === 2) {
      if (!districtInput.value.trim()) { showError('Please enter the district.'); return }
      showStep(3)
      return
    }

    if (currentStep === 3) {
      const digits = phoneInput.value.trim()
      const c = currentCountry()
      if (digits.length < c.min || digits.length > c.max) {
        const lenLabel = c.min === c.max ? `exactly ${c.min} digits` : `${c.min}–${c.max} digits`
        showError(`Enter a valid WhatsApp number — ${c.name} needs ${lenLabel}.`)
        return
      }
      showStep(4)
      return
    }

    if (currentStep === 4) {
      const nft = nftInput.value.trim()
      if (!identifierIsValid(nft)) {
        showError(activeBoard === 'ts'
          ? 'Link ID must be exactly 10 characters.'
          : 'Passport NFT must be exactly 5 digits.')
        return
      }

      nextBtn.disabled = true
      const prevNextLabel = nextBtn.textContent
      nextBtn.textContent = 'Checking…'
      try {
        const existing = await findExistingNft(nft)
        if (existing) {
          if (existing.board === activeBoard && existing.level === Number(activeLevel)) {
            // Same board, same level — this is a straight duplicate, not an upgrade.
            showError(`${identifierName(existing.board)} ${nft} is already there in ${BOARD_LABELS[existing.board] || existing.board} Level ${existing.level}.`)
            return
          }
          // Found elsewhere — offer to continue as an upgrade/transfer to the level
          // they picked. This also covers moving between boards.
          isUpgrade = true
          upgradeFromLevel = existing.level
          upgradeNoticeText.textContent = `${identifierName(existing.board)} ${nft} is already there in ${BOARD_LABELS[existing.board] || existing.board} Level ${existing.level}. Do you want to upgrade to ${BOARD_LABELS[activeBoard]} Level ${activeLevel} and continue?`
          upgradeNotice.classList.add('open')
          nftInput.disabled = true
          nextBtn.style.display = 'none'
          return
        }
        isUpgrade = false
        upgradeFromLevel = null
      } catch (err) {
        console.error(err)
        showError(`Could not verify the ${identifierName(activeBoard)} — please try again.`)
        return
      } finally {
        nextBtn.disabled = false
        nextBtn.textContent = prevNextLabel
      }

      showStep(5)
      return
    }

    showStep(Math.min(currentStep + 1, TOTAL_STEPS - 1))
  })

  async function uploadPhoto(file, board, level) {
    const ext = (file.name && file.name.split('.').pop()) || 'jpg'
    const path = `${board}/${level}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    formError.style.display = 'none'

    const name = nameInput.value.trim()
    const district = districtInput.value.trim()
    const c = currentCountry()
    const fullPhone = `${c.code}${phoneInput.value.trim()}`
    const nft = nftInput.value.trim()
    const proofPhoto = proofPhotoInput.files[0]

    if (!name || !district || !croppedPhotoBlob || phoneInput.value.trim().length < c.min || !identifierIsValid(nft) || !proofPhoto || !proofPhoto.type.startsWith('image/') || proofPhoto.size > MAX_PROOF_PHOTO_BYTES) {
      showError('Please complete every step before submitting.')
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = 'Submitting…'

    try {
      // last-moment re-check in case someone else grabbed this NFT number while this
      // person was filling out the rest of the form
      const existing = await findExistingNft(nft)
      if (existing) {
        const isExpectedUpgradeTarget = isUpgrade && existing.level === upgradeFromLevel
        if (!isExpectedUpgradeTarget) {
          showStep(4)
          showError(`${identifierName(existing.board)} ${nft} is already there in ${BOARD_LABELS[existing.board] || existing.board} Level ${existing.level}.`)
          return
        }
      }

      const hofPhotoFile = new File([croppedPhotoBlob], 'hall-of-fame.jpg', { type: 'image/jpeg' })
      const [hofPhotoUrl, proofPhotoUrl] = await Promise.all([
        uploadPhoto(hofPhotoFile, activeBoard, activeLevel),
        uploadPhoto(proofPhoto, activeBoard, activeLevel),
      ])

      const { error: insertError } = await supabase.from('requests').insert({
        board: activeBoard,
        level: Number(activeLevel),
        name,
        district,
        phone: fullPhone,
        passport_nft: nft,
        photo_url: hofPhotoUrl,
        proof_photo_url: proofPhotoUrl,
        is_upgrade: isUpgrade,
        upgrade_from_level: isUpgrade ? upgradeFromLevel : null,
      })
      if (insertError) {
        if (insertError.code === '23505' && !isUpgrade) {
          showStep(4)
          showError(`${identifierName(activeBoard)} ${nft} is already there — someone just registered it.`)
          return
        }
        throw insertError
      }

      requestForm.style.display = 'none'
      formSuccess.style.display = 'block'
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch (err) {
      console.error(err)
      showError(err.message || 'Something went wrong. Please try again.')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Submit'
    }
  })

  // ---- Init + realtime ----
  loadMembers()

  supabase
    .channel('members-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
      loadMembers()
    })
    .subscribe()

  // Safety net: if a realtime event is ever missed (dropped websocket, or Realtime
  // not enabled for this table in the Supabase dashboard), this guarantees the
  // roster still catches up — every 15s, and instantly whenever the tab regains focus.
  setInterval(loadMembers, 15000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadMembers()
  })

  window.addEventListener('resize', () => {
    levelListEl.querySelectorAll('.photo-carousel').forEach((carousel) => sizeCarousel(carousel))
  })