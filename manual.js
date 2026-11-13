// ================= 全局变量 =================
let currentRole = 'business';
const roleTabs = document.querySelectorAll('.role-tab');
const navList = document.getElementById('navList');
const allSections = document.querySelectorAll('.content-section');
const menuLinks = document.querySelectorAll('.menu-link');
const quickNavContainer = document.getElementById('quickNav');

// ================= 只给 h2 批量打 id =================
function tagHeadings() {
    document.querySelectorAll('.content-section').forEach(section => {
        const sectionId = section.id; // chapter1 / deploy1 / manager1 ...
        const headings = section.querySelectorAll('h2'); // 👈 只取 h2
        headings.forEach((h, i) => {
            h.id = `${sectionId}-h-${i}`;
        });
    });
}

// ================= 获取当前章节的 h2 列表 =================
function getSectionHeadings(section) {
    if (!section) return [];
    return Array.from(section.querySelectorAll('h2')); // 👈 只返回 h2
}

// ================= 角色切换 =================
function switchRole(role) {
    currentRole = role;

    roleTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.role === role);
    });

    navList.querySelectorAll('li').forEach(li => {
        li.style.display = (li.dataset.role === role) ? '' : 'none';
    });

    allSections.forEach(sec => sec.classList.remove('show'));

    const firstSection = document.querySelector(`.content-section[data-role="${role}"]`);
    if (firstSection) firstSection.classList.add('show');

    const links = navList.querySelectorAll(`li[data-role="${role}"] .menu-link`);
    links.forEach(a => a.classList.remove('active'));
    if (links.length > 0) links[0].classList.add('active');

    updateQuickNav();
    window.scrollTo(0, 0);

    if (window.innerWidth <= 1024) closeSidebar();
}

roleTabs.forEach(tab => {
    tab.addEventListener('click', () => switchRole(tab.dataset.role));
});

// ================= 左侧章节切换 =================
menuLinks.forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').replace('#', '');
        const targetSection = document.getElementById(targetId);
        if (!targetSection) return;

        if (targetSection.dataset.role !== currentRole) {
            switchRole(targetSection.dataset.role);
        }

        menuLinks.forEach(a => a.classList.remove('active'));
        this.classList.add('active');

        allSections.forEach(s => s.classList.remove('show'));
        targetSection.classList.add('show');

        updateQuickNav();
        window.scrollTo(0, 0);

        if (window.innerWidth <= 1024) closeSidebar();
    });
});

// ================= 移动端侧边栏 =================
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}
function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
}
if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    overlay.addEventListener('click', closeSidebar);
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeSidebar();
            overlay.classList.remove('show');
        }
    });
}

// ================= 生成右侧快速导航（只基于 h2） =================
function updateQuickNav() {
    if (!quickNavContainer) return;

    const activeSection = document.querySelector('.content-section.show');
    const headings = getSectionHeadings(activeSection);

    if (!activeSection || headings.length === 0) {
        quickNavContainer.style.display = 'none';
        quickNavContainer.innerHTML = '';
        return;
    }

    let navHTML = `
        <div class="quick-nav-title">快速导航</div>
        <ul class="quick-nav-list" id="quickNavList">
            <div class="quick-nav-indicator" id="navIndicator"></div>
    `;

    headings.forEach(h => {
        let text = (h.innerText || h.textContent || '').trim();
        if (text.length > 12) text = text.substring(0, 12) + '...';
        navHTML += `<li><a href="#${h.id}" class="quick-nav-link" data-target="${h.id}">${text}</a></li>`;
    });

    navHTML += `</ul>`;
    quickNavContainer.innerHTML = navHTML;
    quickNavContainer.style.display = 'block';

    // 导航点击有颜色改变的效果
    quickNavContainer.querySelectorAll('.quick-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const el = document.getElementById(link.dataset.target);
            if (el) {
                // 1. 触发页面滚动（如果页面够长）
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.replaceState(null, '', '#' + link.dataset.target);

                // 2. 👇 核心修复：强制让当前点击的按钮变橙色！
                const links = quickNavContainer.querySelectorAll('.quick-nav-link');
                const indicator = document.getElementById('navIndicator');

                links.forEach(l => {
                    const isActive = (l === link); // 只有当前点击的这个是 active
                    l.classList.toggle('active', isActive);
                    if (isActive && indicator) {
                        indicator.style.opacity = '1';
                        indicator.style.top = (l.offsetTop + 8) + 'px';
                        indicator.style.height = Math.max(l.offsetHeight - 16, 4) + 'px';
                    }
                });
            }
        });
    });

    updateActiveNavState();
}

// ================= 滚动高亮（只基于 h2） =================
function updateActiveNavState() {
    if (!quickNavContainer) return;
    const links = quickNavContainer.querySelectorAll('.quick-nav-link');
    const indicator = document.getElementById('navIndicator');
    if (!links.length || !indicator) return;

    const activeSection = document.querySelector('.content-section.show');
    const headings = getSectionHeadings(activeSection);
    if (headings.length === 0) return;

    const offset = 110;
    let currentId = headings[0].id;
    for (const h of headings) {
        if (h.getBoundingClientRect().top <= offset) currentId = h.id;
        else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 5) {
        currentId = headings[headings.length - 1].id;
    }

    links.forEach(link => {
        const isActive = link.dataset.target === currentId;
        link.classList.toggle('active', isActive);
        if (isActive) {
            indicator.style.opacity = '1';
            indicator.style.top = (link.offsetTop + 8) + 'px';
            indicator.style.height = Math.max(link.offsetHeight - 16, 4) + 'px';
        }
    });
}

window.addEventListener('scroll', updateActiveNavState, { passive: true });
window.addEventListener('resize', updateActiveNavState);

// ================= 图片放大灯箱 =================
const lightbox = document.getElementById('imageLightbox');
const lightboxImg = document.getElementById('lightboxImg');

window.openLightbox = function (imageSrc) {
    if (!lightbox || !lightboxImg) return;
    lightbox.style.display = 'flex';
    lightboxImg.src = imageSrc;
    document.body.style.overflow = 'hidden';
};

if (lightbox) {
    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
            lightbox.style.display = 'none';
            document.body.style.overflow = '';
        }
    });
}

// ================= 初始化 =================
(function init() {
    tagHeadings(); // 👈 只给 h2 打 id

    if (window.location.hash) {
        const targetId = window.location.hash.replace('#', '');
        const targetLink = document.querySelector(`.menu-link[href="#${targetId}"]`);
        if (targetLink) {
            const targetRole = targetLink.closest('li').dataset.role;
            switchRole(targetRole);
            targetLink.click();
            return;
        }
    }
    switchRole('business');
    const chapter2Link = document.querySelector('.menu-link[href="#chapter2"]');
    if (chapter2Link) chapter2Link.click();
})();