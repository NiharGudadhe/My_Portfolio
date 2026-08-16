/* ============================================================
   1. CONFIGURATION
============================================================ */
const CONFIG = {
  emailJS: {
    publicKey: "A539OexJ-E_Lqpxkh",
    serviceID: "service_72iw6k8",
    templateID: "template_t6iofv5"
  },
  colors: {
    particles: 0x00f3ff,
    connections: 0xbc13fe
  }
};

// Init EmailJS
document.addEventListener("DOMContentLoaded", () => {
  if (typeof emailjs !== "undefined") emailjs.init(CONFIG.emailJS.publicKey);
});

/* ============================================================
   2. THREE.JS 3D BACKGROUND (Responsive & Gyroscope)
============================================================ */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Optimized DPI for performance
renderer.sortObjects = false; // Disable automatic sorting for better performance
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- GEOMETRY: PARTICLE SPHERE ---
const isMobile = window.innerWidth < 768;
const particlesCount = isMobile ? 300 : 1200; // Performance optimization for mobile
const posArray = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 10;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
  size: 0.02,
  color: CONFIG.colors.particles,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// --- CONNECTING LINES (WIRE SPHERE) ---
const geometry2 = new THREE.IcosahedronGeometry(1, 0); // detail=0: 20 faces (was 1: ~80 faces) — better perf
const material2 = new THREE.MeshBasicMaterial({ 
  color: CONFIG.colors.connections, 
  wireframe: true, 
  transparent: true, 
  opacity: 0.15 
});
const wireframeSphere = new THREE.Mesh(geometry2, material2);
scene.add(wireframeSphere);

camera.position.z = 3;

// --- INTERACTION VARIABLES ---
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
let gyroX = 0;
let gyroY = 0;

const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

// --- MOUSE MOVEMENT (DESKTOP) - THROTTLED ---
let lastMouseMove = 0;
const MOUSE_THROTTLE = 16; // ~60fps

document.addEventListener('mousemove', (event) => {
  const now = Date.now();
  if (now - lastMouseMove >= MOUSE_THROTTLE) {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
    lastMouseMove = now;
  }
});

// --- GYROSCOPE (MOBILE) ---
// This detects phone rotation and updates gyro variables
let lastGyroUpdate = 0;
const GYRO_THROTTLE = 33; // ~30fps

window.addEventListener('deviceorientation', (event) => {
  const now = performance.now();
  if (now - lastGyroUpdate < GYRO_THROTTLE) return;
  lastGyroUpdate = now;
  // gamma: left-to-right tilt in degrees, beta: front-to-back tilt
  if (event.gamma && event.beta) {
    gyroX = event.gamma * 2; // Multiplier for sensitivity
    gyroY = event.beta * 2;
  }
});

// --- SMOOTH SCROLL CAMERA PARALLAX ---
let rawScrollY = 0;
let smoothScrollY = 0;
const SCROLL_LERP = 0.04;                    // Smoothing factor: lower = silkier
const PARTICLES_SCROLL_FACTOR = 0.00025;     // Parallax speed for particle cloud
const SPHERE_SCROLL_FACTOR = 0.00012;        // Parallax speed for wireframe sphere

// --- SECTION-AWARE CINEMATIC CAMERA TARGETS ---
// Each section defines where the Three.js camera smoothly travels to
const sectionCameraTargets = {
  'home':           { z: 3.0, y:  0.00, fov: 75, pOpacity: 0.80, sOpacity: 0.15 },
  'about':          { z: 3.9, y: -0.15, fov: 72, pOpacity: 0.55, sOpacity: 0.10 },
  'projects':       { z: 4.7, y: -0.20, fov: 70, pOpacity: 0.45, sOpacity: 0.08 },
  'skills':         { z: 5.3, y: -0.15, fov: 68, pOpacity: 0.40, sOpacity: 0.12 },
  'resume':         { z: 4.8, y: -0.30, fov: 70, pOpacity: 0.35, sOpacity: 0.10 },
  'certifications': { z: 5.5, y: -0.25, fov: 67, pOpacity: 0.30, sOpacity: 0.10 },
  'contact':        { z: 4.2, y:  0.05, fov: 73, pOpacity: 0.55, sOpacity: 0.15 }
};
// Start at home target; updated by sectionCameraObserver
let activeCameraTarget = { ...sectionCameraTargets['home'] };
// Lerp speed — slightly slower on mobile for smoothness at 30 fps
const CAMERA_SECTION_LERP = isMobile ? 0.015 : 0.025;
// Opacity lerp for particle field transitions
const OPACITY_LERP = 0.02;
// Camera tilt lerp — how quickly the tilt snaps back after scrolling
const TILT_LERP = 0.06;

// Scroll-velocity tilt — camera tilts forward when scrolling fast (cinematic dolly)
let prevRawScrollY = 0;
let cameraXTilt = 0;
const TILT_STRENGTH = isMobile ? 0.00007 : 0.00013;

// Observe each section; update camera target when it enters the viewport
const sectionCameraObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const target = sectionCameraTargets[entry.target.id];
      if (target) Object.assign(activeCameraTarget, target);
    }
  });
}, { threshold: 0.35 });
document.querySelectorAll('section[id]').forEach(s => sectionCameraObserver.observe(s));

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let prefersReducedMotion = reducedMotionQuery.matches;
reducedMotionQuery.addEventListener('change', (e) => {
  prefersReducedMotion = e.matches;
  // Sync smoothScrollY so there is no jarring jump on preference change
  smoothScrollY = rawScrollY;
  // Snap camera to active target immediately (no lerp drift)
  if (e.matches) {
    camera.position.z = activeCameraTarget.z;
    camera.position.y = activeCameraTarget.y;
    camera.rotation.x = 0;
    camera.fov = activeCameraTarget.fov;
    camera.updateProjectionMatrix();
  }
});

// --- SCROLL PROGRESS BAR ---
const scrollProgressEl = document.getElementById('scroll-progress');
function updateScrollProgress(progress) {
  if (scrollProgressEl) scrollProgressEl.style.width = (progress * 100) + '%';
}

// --- NATIVE BROWSER SCROLLING (Lenis smooth scroll disabled) ---
let lenis; // kept as unused placeholder so the animate() loop below still works untouched
window.addEventListener('scroll', () => {
  rawScrollY = window.scrollY;
  const limit = document.documentElement.scrollHeight - window.innerHeight;
  const progress = limit > 0 ? rawScrollY / limit : 0;
  updateScrollProgress(progress);
}, { passive: true });

// --- HERO PARALLAX ZOOM ON SCROLL ---
const heroTextEl = document.querySelector('.hero-text');
const HERO_PARALLAX_SPEED = 0.25;    // How fast hero content moves relative to scroll
const HERO_FADE_MULTIPLIER = 1.4;    // How quickly hero fades as user scrolls past
const HERO_SCALE_FACTOR = 0.06;      // Max scale increase at bottom of hero section
const HERO_REVEAL_TRANSITION_MS = 900; // Slightly longer than the 0.8s reveal CSS transition

function updateHeroParallax(scrollY) {
  if (!heroTextEl || prefersReducedMotion) return;
  const heroH = window.innerHeight;
  const progress = Math.min(scrollY / heroH, 1);
  const translateY = scrollY * HERO_PARALLAX_SPEED;
  const opacity = 1 - progress * HERO_FADE_MULTIPLIER;
  const scale = 1 + progress * HERO_SCALE_FACTOR;
  heroTextEl.style.transform = `translateY(${translateY}px) scale(${scale})`;
  heroTextEl.style.opacity = Math.max(0, opacity);
}

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();
const MOBILE_FRAME_INTERVAL = 1000 / 30; // 30fps cap on mobile
let lastFrameTime = 0;
let animationId;

function animate(time = 0) {
  animationId = requestAnimationFrame(animate);

  // Drive Lenis smooth scroll each frame
  if (lenis) lenis.raf(time);

  // Cap to 30fps on mobile to reduce GPU load
  if (isMobile) {
    if (time - lastFrameTime < MOBILE_FRAME_INTERVAL) return;
    lastFrameTime = time;
  }

  const elapsedTime = clock.getElapsedTime();

  // Determine target based on device type (Mouse or Gyro)
  if (window.innerWidth < 900 && (gyroX !== 0 || gyroY !== 0)) {
    // Use Gyro data on mobile if available
    targetX = gyroX;
    targetY = gyroY;
  } else {
    // Use Mouse data on desktop
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;
  }

  // Smooth Rotation Logic
  particlesMesh.rotation.y = elapsedTime * 0.05; // Constant slow spin
  particlesMesh.rotation.x += 0.05 * (targetY - particlesMesh.rotation.x);
  particlesMesh.rotation.y += 0.05 * (targetX - particlesMesh.rotation.y);

  wireframeSphere.rotation.x = elapsedTime * 0.1;
  wireframeSphere.rotation.y = elapsedTime * 0.1;

  // Breathing/Pulse effect
  const scale = 1 + Math.sin(elapsedTime * 2) * 0.05;
  wireframeSphere.scale.set(scale, scale, scale);

  // Smooth camera scroll parallax (premium cinematic feel)
  if (!prefersReducedMotion) {
    smoothScrollY += (rawScrollY - smoothScrollY) * SCROLL_LERP;
  } else {
    // Keep smoothScrollY in sync so toggling preference never causes a jump
    smoothScrollY = rawScrollY;
  }
  if (!prefersReducedMotion) {
    // Section-aware camera: lerp toward the target Z/Y for the active section
    camera.position.z += (activeCameraTarget.z - camera.position.z) * CAMERA_SECTION_LERP;
    camera.position.y += (activeCameraTarget.y - camera.position.y) * CAMERA_SECTION_LERP;

    // Cinematic tilt: forward lean based on scroll velocity (dolly-push feel)
    const scrollVelocityNow = rawScrollY - prevRawScrollY;
    prevRawScrollY = rawScrollY;
    cameraXTilt = scrollVelocityNow * TILT_STRENGTH;
    camera.rotation.x += (cameraXTilt - camera.rotation.x) * TILT_LERP;

    // FOV breathing per section — widens on hero, narrows as user explores deeper
    if (Math.abs(camera.fov - activeCameraTarget.fov) > 0.05) {
      camera.fov += (activeCameraTarget.fov - camera.fov) * CAMERA_SECTION_LERP;
      camera.updateProjectionMatrix();
    }

    // Particle field visual density transitions per section
    particlesMaterial.opacity += (activeCameraTarget.pOpacity - particlesMaterial.opacity) * OPACITY_LERP;
    material2.opacity += (activeCameraTarget.sOpacity - material2.opacity) * OPACITY_LERP;

    // Particle cloud and sphere slow parallax (depth layers)
    particlesMesh.position.y = smoothScrollY * PARTICLES_SCROLL_FACTOR;
    wireframeSphere.position.y = -smoothScrollY * SPHERE_SCROLL_FACTOR;

    updateHeroParallax(smoothScrollY);
  }

  renderer.render(scene, camera);
}
animate();

// Pause Three.js when the browser tab is hidden to save GPU/CPU
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(animationId);
    clock.stop();
  } else {
    clock.start();
    lastFrameTime = 0;
    animate();
  }
});

// --- RESIZE HANDLER (debounced) ---
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, 100);
});


/* ============================================================
   3. SCROLL REVEAL ANIMATIONS (Intersection Observer — with reverse)
   Optimized for both desktop and mobile with reduced-motion support
============================================================ */
const revealElements = document.querySelectorAll(".reveal");

// Use smaller threshold on mobile for earlier triggering (improves perceived performance)
const revealThreshold = isMobile ? 0.05 : 0.1;
const revealRootMargin = isMobile ? '0px 0px -30px 0px' : '0px 0px -50px 0px';

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    // Skip animations entirely if user prefers reduced motion
    if (prefersReducedMotion) {
      entry.target.classList.add("active");
      entry.target.style.transition = 'none';
      return;
    }
    
    if (entry.isIntersecting) {
      // Use requestAnimationFrame for smoother animation triggering
      requestAnimationFrame(() => {
        entry.target.classList.add("active");
      });
    } else if (entry.boundingClientRect.top > 0) {
      // Element is below the viewport — user scrolled back up; reset for re-entry
      requestAnimationFrame(() => {
        entry.target.classList.remove("active");
      });
    }
  });
}, { threshold: revealThreshold, rootMargin: revealRootMargin });

revealElements.forEach((el) => revealObserver.observe(el));

// Directional reveal elements (reveal-left / reveal-right)
const directionalRevealEls = document.querySelectorAll('.reveal-left, .reveal-right');
const directionalRevealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    // Skip animations if user prefers reduced motion
    if (prefersReducedMotion) {
      entry.target.classList.add('active');
      entry.target.style.transition = 'none';
      return;
    }
    
    if (entry.isIntersecting) {
      requestAnimationFrame(() => {
        entry.target.classList.add('active');
      });
    } else if (entry.boundingClientRect.top > 0) {
      requestAnimationFrame(() => {
        entry.target.classList.remove('active');
      });
    }
  });
}, { threshold: revealThreshold, rootMargin: revealRootMargin });
directionalRevealEls.forEach(el => directionalRevealObserver.observe(el));


/* ============================================================
   4. TYPEWRITER EFFECT (role — started after name typing finishes)
============================================================ */
const roles = ["DATA SCIENTIST"];
let roleIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typeTarget = document.getElementById("typewriter");

function type() {
  const currentRole = roles[roleIndex];
  
  if (isDeleting) {
    typeTarget.textContent = currentRole.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typeTarget.textContent = currentRole.substring(0, charIndex + 1);
    charIndex++;
  }

  if (!isDeleting && charIndex === currentRole.length) {
    // Don't delete if only one role, just stay at the end
    if (roles.length === 1) {
      return;
    }
    setTimeout(() => isDeleting = true, 2000);
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    roleIndex = (roleIndex + 1) % roles.length;
  }

  const speed = isDeleting ? 50 : 100;
  setTimeout(type, speed);
}
// Role typing is started by startHeroTyping() after name is done


/* ============================================================
   5. MOBILE MENU & CURSOR
============================================================ */
const mobileToggle = document.getElementById('mobile-toggle');
const navLinks = document.querySelector('.nav-links');
const navBackdrop = document.getElementById('nav-backdrop');

function openMobileNav() {
  navLinks.classList.add('active');
  mobileToggle.classList.add('active');
  if (navBackdrop) navBackdrop.classList.add('active');
}

function closeMobileNav() {
  navLinks.classList.remove('active');
  mobileToggle.classList.remove('active');
  if (navBackdrop) navBackdrop.classList.remove('active');
}

if (mobileToggle) {
  mobileToggle.addEventListener('click', () => {
    if (navLinks.classList.contains('active')) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });
  
  // Close menu when a link is clicked
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });
}

// Close mobile nav when clicking the backdrop
if (navBackdrop) {
  navBackdrop.addEventListener('click', closeMobileNav);
}

/* ============================================================
   HOVER PANEL - Show/Hide on Project Card Click
============================================================ */
const hoverPanel = document.getElementById('hover-panel');
const panelTitle = document.getElementById('panel-title');
const panelDescription = document.getElementById('panel-description');
const closePanelBtn = document.querySelector('.close-panel-btn');

// Project data for hover panel
const projectData = {
  'shoppers-intent': {
    title: 'SHOPPERS INTENT MLOPS PIPELINE',
    description: `Built an end-to-end production-grade <b>MLOps classification system</b> predicting online shopper purchase intentions using <b>Random Forest</b>, <b>XGBoost</b>, and <b>LightGBM</b>, optimized with hyperparameter tuning via <b>GridSearchCV</b> and <b>SMOTE</b> for class imbalance.<br><br><b>Key Highlights</b><br><br><b>1) Model Development</b><br>Trained and compared multiple ensemble classifiers to predict whether an online shopping session would convert, tuning hyperparameters with GridSearchCV and handling class imbalance with SMOTE.<br><br><b>2) Serving Layer</b><br>Developed an interactive web frontend paired with a <b>FastAPI</b> backend for live user session risk evaluation, returning instant prediction probabilities.<br><br><b>3) Experiment Tracking & Deployment</b><br>Implemented automated experiment tracking and model registration via <b>MLflow</b>, containerized the app with <b>Docker</b>, and deployed it live on <b>Render</b>.<br><br><b>4) Monitoring</b><br>Set up automated data drift monitoring using <b>Evidently AI</b> to catch model degradation in production.<br><br><b>Tools:</b> Python, FastAPI, MySQL, PostgreSQL, Scikit-learn, XGBoost, LightGBM, MLflow, Evidently AI, Docker, Render`
  },
  'opinion-metrix': {
    title: 'OPINIONMETRIX AI SENTIMENT TRANSFORMER',
    description: `Built an advanced <b>transformer-based sentiment analysis pipeline</b> evaluating contextual polarity and fine-tuned embeddings for text data, leveraging state-of-the-art NLP models for high-accuracy text classification.<br><br><b>Key Highlights</b><br><br><b>1) Model Development</b><br>Utilized transformer architectures and pre-trained Hugging Face models to analyze contextual nuance, handling deep semantic representations and fine-tuning embeddings.<br><br><b>2) Pipeline Engineering</b><br>Structured a clean, production-ready Python pipeline for data preprocessing, tokenization, and model inference with PyTorch.<br><br><b>3) Serving & Integration</b><br>Integrated efficient model inference workflows designed for text classification tasks with robust modular code design.<br><br><b>Tools:</b> Python, Transformers, PyTorch, Hugging Face, Scikit-learn, Pandas`
  },
  'sqipe-platform': {
    title: 'SQIPE ENTERPRISE ANALYTICS & ML PRICING PLATFORM',
    description: `Engineered an end-to-end data integration, machine learning pricing engine, and business intelligence platform to automate custom quotation workflows and streamline manufacturing operations.<br><br><b>Key Highlights</b><br><br><b>1) Data Ingestion & ETL Pipelines</b><br>Engineered automated Python extraction, transformation, and loading scripts (<b>etl_pipeline/</b>) to sync raw CRM webhooks and Tally transaction logs into a structured MySQL/PostgreSQL relational warehouse.<br><br><b>2) Modular dbt Data Modeling</b><br>Implemented modular data transformations using <b>dbt (Data Build Tool)</b> to maintain clean staging views and relational fact/dimension marts as a reliable single source of truth.<br><br><b>3) Predictive Pricing Engine</b><br>Developed and productionized a custom <b>Random Forest Regression</b> model via Scikit-learn to analyze non-linear component costs and historical win-loss ratios for custom industrial equipment.<br><br><b>4) FastAPI & Containerized Deployment</b><br>Containerized model artifacts and deployed high-performance real-time inference endpoints using <b>FastAPI</b> within multi-container Docker environments.<br><br><b>5) Business Intelligence Reporting</b><br>Developed performance-tuned SQL dashboard queries integrated into native executive <b>Power BI</b> templates to monitor industrial pipeline conversions and inventory trends.<br><br><b>Tools:</b> Python, Scikit-Learn, PostgreSQL, MySQL, dbt, FastAPI, Docker, Power BI`
  },
  'laptop-price': {
    title: 'LAPTOP PRICE PREDICTION SYSTEM',
    description: `Built an <b>end-to-end machine learning pipeline</b> for laptop price prediction, with a modular structure separating data ingestion, transformation, and model training scripts.<br><br><b>Key Highlights</b><br><br><b>1) Modular Pipeline Design</b><br>Structured the project so data ingestion, transformation, and model training run as independent, testable stages rather than one monolithic script.<br><br><b>2) Execution Logging</b><br>Added automated execution logging via a dedicated directory to track pipeline runs, debug issues, and monitor execution metrics over time.<br><br><b>3) Verification & Integrity Checks</b><br>Wrote a verification script to validate model checkpoint loading, artifact integrity, and pipeline outputs before deployment — catching broken artifacts before they reach production.<br><br><b>4) Deployment</b><br>Deployed a web app using <b>Flask/FastAPI</b>, backed by structured artifact storage for price estimation.<br><br><b>Tools:</b> Python, Flask, FastAPI`
  },
  'loan-default': {
    title: 'LOAN DEFAULT RISK PREDICTION',
    description: `An end-to-end machine learning application that predicts the probability of a client defaulting on a loan using an <b>XGBoost</b> classifier and a <b>Scikit-learn</b> pipeline, with a <b>Streamlit</b> web app for real-time predictions.<br><br><b>Key Highlights</b><br><br><b>1) Interactive Web App</b><br>A clean Streamlit interface for live input entry and instant default risk assessment.<br><br><b>2) Optimized Machine Learning</b><br>Built with XGBoost and accelerated using Intel's scikit-learn extension for faster training and inference.<br><br><b>3) Fairness & Bias Assessment</b><br>Includes dedicated scripts to evaluate model behavior across sensitive attributes, helping catch biased predictions before deployment.<br><br><b>Tools:</b> Python, XGBoost, Scikit-learn, Streamlit`
  },
  'spam-classifier': {
    title: 'SPAM EMAIL CLASSIFIER',
    description: `A production-grade machine learning system that classifies emails as Spam or Ham (legitimate), with a modular pipeline for training and inference and a Streamlit UI for interaction.<br><br><b>Key Highlights</b><br><br><b>1) Advanced ML Pipeline</b><br>Modular design separating data ingestion, transformation, and model training into independent stages.<br><br><b>2) Multiple Model Support</b><br>Evaluated several algorithms — SVM, Logistic Regression, Decision Trees, and Random Forest — to select the best performer.<br><br><b>3) Interactive Web UI</b><br>Built with Streamlit for real-time single-email analysis and batch processing.<br><br><b>4) MBOX Support</b><br>Native capability to process and classify entire mbox email archives.<br><br><b>5) Detailed Analytics</b><br>Comprehensive logging and performance metrics — Precision, Recall, and F1-Score — for every trained model.<br><br><b>Tools:</b> Python, Scikit-learn, Streamlit, Pandas, NumPy`
  }
};

// Smooth panel open function
function openPanel(projectKey) {
  if (projectKey && projectData[projectKey]) {
    const data = projectData[projectKey];
    panelTitle.textContent = data.title;
    panelDescription.innerHTML = data.description;
    
    // Trigger animation
    requestAnimationFrame(() => {
      if (hoverPanel) hoverPanel.classList.add('active');
    });
  }
}

// Smooth panel close function
function closePanel() {
  if (hoverPanel) {
    hoverPanel.classList.remove('active');
  }
}

// Pointer capability detection (more reliable than viewport width)
const isTouchDevice = () => window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const hasFinePointer = () => window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Change hint text on touch devices
if (isTouchDevice()) {
  document.querySelectorAll('.card-hint span').forEach(span => {
    span.textContent = 'Tap to learn more';
  });
}

// Track the currently tapped card for efficient class management
let tappedCard = null;

// Click behavior for all devices
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('click', (e) => {
    // Don't trigger if clicking on links
    if (e.target.closest('.link-btn')) {
      return;
    }
    const projectKey = card.getAttribute('data-project');

    // Two-tap behavior on touch devices
    if (isTouchDevice() && card !== tappedCard) {
      // First tap: highlight the card and show the hint
      if (tappedCard) tappedCard.classList.remove('card-tapped');
      tappedCard = card;
      card.classList.add('card-tapped');
      return;
    }

    // Second tap (or desktop click): open panel
    if (tappedCard) {
      tappedCard.classList.remove('card-tapped');
      tappedCard = null;
    }
    openPanel(projectKey);
  });
});

// Close panel button
if (closePanelBtn) {
  closePanelBtn.addEventListener('click', closePanel);
}

// Close panel when clicking outside
if (hoverPanel) {
  document.addEventListener('click', (e) => {
    if (!hoverPanel.contains(e.target) && !e.target.closest('.project-card')) {
      closePanel();
      if (tappedCard) {
        tappedCard.classList.remove('card-tapped');
        tappedCard = null;
      }
    }
  });
}

// Custom Cursor Logic (Desktop Only) - Optimized with RAF & transform (no layout reflow)
const cursorDot = document.querySelector("[data-cursor-dot]");
const cursorOutline = document.querySelector("[data-cursor-outline]");
let cursorX = 0, cursorY = 0;
let outlineX = 0, outlineY = 0;

if (hasFinePointer()) {
  // Smooth cursor outline following — uses transform (GPU-composited)
  function animateCursor() {
    outlineX += (cursorX - outlineX) * 0.2;
    outlineY += (cursorY - outlineY) * 0.2;
    cursorOutline.style.transform = `translate(${outlineX}px, ${outlineY}px)`;
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
  
  // Optimized mousemove — transform avoids triggering layout
  let cursorMoveHandler = (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
    cursorDot.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
  };
  
  document.addEventListener("mousemove", cursorMoveHandler);
  
  // Event delegation for interactive elements - OPTIMIZED
  const selectiveSelectors = 'a, button, input, textarea, select, .link-btn, .btn-3d, .submit-btn, .nav-links a, .magnetic-link, .resume-btn, .hire-me-btn, .social-links a, .project-card, .skill-block, .card-links a';
  
  document.addEventListener('mouseenter', (e) => {
    const target = e.target.closest(selectiveSelectors);
    if (target) document.body.classList.add('cursor-interactive');
  }, true);
  
  document.addEventListener('mouseleave', (e) => {
    const target = e.target.closest(selectiveSelectors);
    if (target) document.body.classList.remove('cursor-interactive');
  }, true);
}


/* ============================================================
   6. FORMS & POPUPS
============================================================ */
// Contact Form
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.submit-btn span');
    const originalText = btn.textContent;
    btn.textContent = "TRANSMITTING...";
    
    try {
      await emailjs.send(CONFIG.emailJS.serviceID, CONFIG.emailJS.templateID, {
        from_name: document.getElementById("name").value,
        email: document.getElementById("email").value,
        reply_to: document.getElementById("email").value,
        message: document.getElementById("message").value
      });
      btn.textContent = "SUCCESS";
      contactForm.reset();
      setTimeout(() => btn.textContent = originalText, 3000);
    } catch (err) {
      console.error(err);
      btn.textContent = "FAILED";
      setTimeout(() => btn.textContent = originalText, 3000);
    }
  });
}

// Model Popup
const modelOnlyBtns = document.querySelectorAll('.model-only');
const modal = document.getElementById('custom-modal');
const closeModal = document.getElementById('close-modal');
const modalCloseButtons = document.querySelectorAll('[data-modal-close]');
let lastFocusedElement = null;

const openModelModal = (triggerBtn) => {
  if (!modal || !closeModal) return;
  lastFocusedElement = document.activeElement;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');
  closeModal.focus();
};

const closeModelModal = () => {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  modelOnlyBtns.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  if (lastFocusedElement) lastFocusedElement.focus();
};

if (modelOnlyBtns.length && modal && closeModal) {
  modelOnlyBtns.forEach(btn => {
    btn.addEventListener('click', () => openModelModal(btn));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModelModal(btn);
      }
    });
  });
}

if (modal && closeModal) {
  modalCloseButtons.forEach(btn => btn.addEventListener('click', closeModelModal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModelModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModelModal();
    }
  });
}


/* ============================================================
   7. PRELOADER
============================================================ */
window.addEventListener("load", () => {
  const preloader = document.getElementById("preloader");
  const loaderText = preloader.querySelector(".loader-text");
  const stages = ["LOADING CORE...", "CONNECTING TO NEURAL NETWORK...", "SYSTEM READY"];
  let step = 0;

  const interval = setInterval(() => {
    if (step < stages.length) {
      loaderText.textContent = stages[step];
      step++;
    } else {
      clearInterval(interval);
      preloader.style.opacity = "0";
      setTimeout(() => {
        preloader.style.display = "none";
        // Open cinematic letterbox bars (black edges animate out)
        document.querySelectorAll('.letterbox-bar').forEach(bar => {
          requestAnimationFrame(() => bar.classList.add('open'));
        });
        startHeroTyping();
      }, 500);
    }
  }, 600);
});

/* ============================================================
   HERO NAME TYPING EFFECT
============================================================ */
function startHeroTyping() {
  const nameEl = document.querySelector('.glitch-header');
  if (!nameEl) {
    if (typeTarget) type();
    return;
  }

  const fullName = nameEl.getAttribute('data-text') || 'NIHAR GUDADHE';

  if (prefersReducedMotion) {
    // Skip typing animation; show immediately and enable glitch
    nameEl.textContent = fullName;
    nameEl.setAttribute('data-text', fullName);
    nameEl.classList.add('typing-done');
    if (typeTarget) type();
    return;
  }

  // Clear visible text for typing effect
  nameEl.textContent = '';
  let idx = 0;

  function typeNameChar() {
    const current = fullName.slice(0, idx);
    nameEl.textContent = current;
    nameEl.setAttribute('data-text', current);

    if (idx < fullName.length) {
      idx++;
      setTimeout(typeNameChar, 75);
    } else {
      // Full name displayed — restore data-text and enable glitch effect
      nameEl.setAttribute('data-text', fullName);
      nameEl.classList.add('typing-done');
      // Small pause, then start role typewriter
      setTimeout(() => {
        if (typeTarget) type();
      }, 300);
    }
  }
  typeNameChar();
}

/* ============================================================
   8. SKILLS HOVER LOGIC — loader color by learning level
============================================================ */
// Threshold per design request: green for 30 or above, red below 30.
const SKILL_LEVEL_THRESHOLD = 30;

document.querySelectorAll(".skill-block").forEach(skill => {
  const percentText = skill.querySelector(".skill-percent");
  const loader = skill.querySelector(".skill-loader");

  if (!percentText || !loader) return;

  const value = Number(skill.dataset.level) || 0;
  const levelClass = value >= SKILL_LEVEL_THRESHOLD ? "green" : "red";

  percentText.textContent = "Proficient";
  percentText.classList.add(levelClass);
  loader.classList.add(levelClass);
});

/* ============================================================
   9. 3D CARD TILT EFFECT (Desktop only)
============================================================ */
if (hasFinePointer()) {
  document.querySelectorAll('.project-card').forEach(card => {
    const glow = card.querySelector('.card-glow');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotX = (0.5 - y) * 12;
      const rotY = (x - 0.5) * 12;
      card.style.transform = `translateY(-10px) perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      // Move glow spotlight to follow cursor (GPU-composited via CSS custom properties)
      if (glow) {
        glow.style.setProperty('--gx', `${(x - 0.5) * rect.width}px`);
        glow.style.setProperty('--gy', `${(y - 0.5) * rect.height}px`);
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      // Reset glow to center
      if (glow) {
        glow.style.setProperty('--gx', '0px');
        glow.style.setProperty('--gy', '0px');
      }
    });
  });
}