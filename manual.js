// ================= 角色切换 =================
const roleTabs = document.querySelectorAll('.role-tab');
const navList = document.getElementById('navList');
const allSections = document.querySelectorAll('.content-section');
let currentRole = 'business';

function switchRole(role) {
    currentRole = role;

    // 更新角色按钮激活态
    roleTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.role === role);
    });

    // 显示/隐藏导航项
    navList.querySelectorAll('li').forEach(li => {
        li.style.display = (li.dataset.role === role) ? '' : 'none';
    });

    // 显示/隐藏章节
    allSections.forEach(sec => {
        sec.classList.remove('show');
    });

    // 找到该角色下的第一个章节并显示
    const firstSection = document.querySelector(`.content-section[data-role="${role}"]`);
    if (firstSection) {
        firstSection.classList.add('show');
    }

    // 设置导航激活态
    const links = navList.querySelectorAll('li[data-role="' + role + '"] .menu-link');
    links.forEach(a => a.classList.remove('active'));
    if (links.length > 0) {
        links[0].classList.add('active');
    }

    // 回到顶部
    window.scrollTo(0, 0);
}

roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        switchRole(tab.dataset.role);
        if (window.innerWidth <= 1024) {
            closeSidebar();
        }
    });
});

// ================= 章节切换 =================
const menuLinks = document.querySelectorAll('.menu-link');
const sections = document.querySelectorAll('.content-section');

menuLinks.forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').replace('#', '');

        menuLinks.forEach(a => a.classList.remove('active'));
        sections.forEach(s => s.classList.remove('show'));

        this.classList.add('active');
        document.getElementById(targetId).classList.add('show');

        if (window.innerWidth <= 1024) {
            closeSidebar();
        }
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
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener('click', closeSidebar);

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeSidebar();
            overlay.classList.remove('show');
        }
    });
}

// 初始化
switchRole('business');