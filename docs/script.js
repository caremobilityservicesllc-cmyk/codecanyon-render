/**
 * RideFlow Documentation - Interactive Scripts
 */

(function() {
  'use strict';

  // ===== DOM Elements =====
  const sidebar = document.querySelector('.sidebar');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.doc-section');

  // ===== Mobile Menu =====
  function initMobileMenu() {
    // Create mobile menu button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.setAttribute('aria-label', 'Toggle menu');
    menuBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    `;
    document.body.appendChild(menuBtn);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);

    // Toggle menu
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
      
      // Update icon
      if (sidebar.classList.contains('open')) {
        menuBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        `;
      } else {
        menuBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        `;
      }
    });

    // Close menu on overlay click
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      menuBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      `;
    });

    // Close menu on nav link click (mobile)
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
          menuBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          `;
        }
      });
    });
  }

  // ===== Active Section Highlighting =====
  function initScrollSpy() {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          
          // Remove active class from all links
          navLinks.forEach(link => link.classList.remove('active'));
          
          // Add active class to matching link
          const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
          if (activeLink) {
            activeLink.classList.add('active');
            
            // Scroll link into view in sidebar
            const sidebarContent = document.querySelector('.sidebar-content');
            const linkRect = activeLink.getBoundingClientRect();
            const sidebarRect = sidebarContent.getBoundingClientRect();
            
            if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
              activeLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      });
    }, observerOptions);

    sections.forEach(section => {
      if (section.id) {
        observer.observe(section);
      }
    });
  }

  // ===== Search Functionality =====
  function initSearch() {
    const sidebarHeader = document.querySelector('.sidebar-header');
    
    // Create search wrapper
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'search-wrapper';
    searchWrapper.innerHTML = `
      <input type="text" class="search-input" placeholder="Search documentation..." />
    `;
    
    // Insert after header
    sidebarHeader.after(searchWrapper);
    
    const searchInput = searchWrapper.querySelector('.search-input');
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      
      navLinks.forEach(link => {
        const text = link.textContent.toLowerCase();
        const section = link.closest('.nav-section');
        
        if (query === '') {
          link.style.display = '';
          if (section) section.style.display = '';
        } else if (text.includes(query)) {
          link.style.display = '';
          if (section) section.style.display = '';
        } else {
          link.style.display = 'none';
        }
      });
      
      // Hide empty sections
      document.querySelectorAll('.nav-section').forEach(section => {
        const visibleLinks = section.querySelectorAll('.nav-link:not([style*="display: none"])');
        section.style.display = visibleLinks.length === 0 ? 'none' : '';
      });
    });

    // Keyboard shortcut (Ctrl/Cmd + K)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
      
      // Escape to clear search
      if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.blur();
      }
    });
  }

  // ===== Smooth Scroll =====
  function initSmoothScroll() {
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          
          if (target) {
            const offset = 80;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
            
            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth'
            });
            
            // Update URL without scrolling
            history.pushState(null, null, href);
          }
        }
      });
    });
  }

  // ===== Copy Code Buttons =====
  function initCopyButtons() {
    const codeBlocks = document.querySelectorAll('.code-block, pre');
    
    codeBlocks.forEach(block => {
      // Skip if already has a copy button
      if (block.querySelector('.copy-btn')) return;
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;
      copyBtn.title = 'Copy to clipboard';
      
      // Style the button
      Object.assign(copyBtn.style, {
        position: 'absolute',
        top: '8px',
        right: '8px',
        padding: '6px',
        background: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        cursor: 'pointer',
        opacity: '0',
        transition: 'opacity 0.15s ease'
      });
      
      // Make parent relative
      const codeParent = block.classList.contains('code-block') ? block : block.parentElement;
      if (codeParent) {
        codeParent.style.position = 'relative';
        
        // Show on hover
        codeParent.addEventListener('mouseenter', () => {
          copyBtn.style.opacity = '1';
        });
        codeParent.addEventListener('mouseleave', () => {
          copyBtn.style.opacity = '0';
        });
      }
      
      copyBtn.addEventListener('click', async () => {
        const code = block.querySelector('code') || block;
        const text = code.textContent;
        
        try {
          await navigator.clipboard.writeText(text);
          
          // Show success
          copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            `;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
      
      if (block.classList.contains('code-block')) {
        block.appendChild(copyBtn);
      } else {
        block.parentElement.appendChild(copyBtn);
      }
    });
  }

  // ===== Table of Contents Collapse =====
  function initTocCollapse() {
    const sectionTitles = document.querySelectorAll('.nav-section-title');
    
    sectionTitles.forEach(title => {
      title.style.cursor = 'pointer';
      title.style.userSelect = 'none';
      
      // Add expand/collapse indicator
      const indicator = document.createElement('span');
      indicator.textContent = ' ▼';
      indicator.style.fontSize = '8px';
      indicator.style.marginLeft = '4px';
      indicator.style.opacity = '0.5';
      title.appendChild(indicator);
      
      title.addEventListener('click', () => {
        const section = title.closest('.nav-section');
        const links = section.querySelectorAll('.nav-link');
        const isCollapsed = links[0]?.style.display === 'none';
        
        links.forEach(link => {
          link.style.display = isCollapsed ? '' : 'none';
        });
        
        indicator.textContent = isCollapsed ? ' ▼' : ' ▶';
      });
    });
  }

  // ===== Handle Hash on Load =====
  function handleInitialHash() {
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) {
        setTimeout(() => {
          const offset = 80;
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }

  // ===== Back to Top Button =====
  function initBackToTop() {
    const backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;
    backToTop.title = 'Back to top';
    
    Object.assign(backToTop.style, {
      position: 'fixed',
      bottom: '24px',
      right: '90px',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      background: 'var(--color-bg-tertiary)',
      border: '1px solid var(--color-border)',
      cursor: 'pointer',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '100',
      transition: 'all 0.2s ease'
    });
    
    document.body.appendChild(backToTop);
    
    // Show/hide based on scroll
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 500) {
        backToTop.style.display = 'flex';
      } else {
        backToTop.style.display = 'none';
      }
    });
    
    backToTop.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
    
    backToTop.addEventListener('mouseenter', () => {
      backToTop.style.borderColor = 'var(--color-primary)';
    });
    
    backToTop.addEventListener('mouseleave', () => {
      backToTop.style.borderColor = 'var(--color-border)';
    });
  }

  // ===== Initialize All =====
  function init() {
    initMobileMenu();
    initScrollSpy();
    initSearch();
    initSmoothScroll();
    initCopyButtons();
    initBackToTop();
    handleInitialHash();
    
    // Optional: TOC collapse
    // initTocCollapse();
    
    console.log('📚 RideFlow Documentation initialized');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();