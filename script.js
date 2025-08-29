// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    onSnapshot,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firestore.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";


// --- Configuração do Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyDf_AyxRX9d2JuVHvk3kScSb7bH8v5Bh-k",
    authDomain: "action-max.firebaseapp.com",
    projectId: "action-max",
    storageBucket: "action-max.appspot.com",
    messagingSenderId: "183609340889",
    appId: "1:183609340889:web:f32fc8e32d95461a1f5fc8"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const loadingScreen = document.getElementById('loading-screen');
    const authPage = document.getElementById('auth-page');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const mainHeader = document.getElementById('main-header');
    const mainContent = document.getElementById('main-content');
    const mainFooter = document.getElementById('main-footer');
    const videoPlayerOverlay = document.getElementById('video-player-overlay');
    const videoPlayer = document.getElementById('video-player');
    const videoSpinner = document.getElementById('video-spinner');
    const closeVideoPlayer = document.getElementById('close-video-player');
    const profileButtonHeader = document.getElementById('profile-button-header');
    const pageSections = document.querySelectorAll('.page-section');
    const detailsPage = document.getElementById('details-page');
    const detailsWatchButton = document.getElementById('details-watch-button');
    const headerSearchButton = document.getElementById('header-search-button');
    const notificationButton = document.getElementById('notification-button');
    const notificationPanel = document.getElementById('notification-panel');
    const notificationList = document.getElementById('notification-list');
    const notificationBadge = document.getElementById('notification-badge');
    const editProfileOverlay = document.getElementById('edit-profile-overlay');
    const avatarSelectionOverlay = document.getElementById('avatar-selection-overlay');
    const avatarSelectionGrid = document.getElementById('avatar-selection-grid');
    const confirmationModal = document.getElementById('confirmation-modal');
    const footerContentModal = document.getElementById('footer-content-modal');
    const closeFooterModalBtn = document.getElementById('close-footer-modal');

    // --- CONSTANTES E VARIÁVEIS GLOBAIS ---
    let currentUserData = null;
    let currentContentId = null;
    let currentContentType = null;
    let commentToDelete = null;
    let allContentData = [];
    let allCategories = [];
    let allAvatars = [];
    let footerSettings = {};
    let unsubscribeListeners = [];
    let hlsInstance = null; // Instância do HLS.js

    // =================================================================
    // CORREÇÃO: LÓGICA DE INICIALIZAÇÃO E AUTENTICAÇÃO OTIMIZADA
    // O setTimeout foi removido para evitar uma espera desnecessária e
    // para garantir que a tela de carregamento só desapareça quando o
    // conteúdo estiver realmente pronto para ser exibido.
    // =================================================================
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado. A página de autenticação fica oculta.
            // A função initializeApp cuidará de carregar os dados e, em seguida,
            // esconder a tela de carregamento.
            authPage.classList.add('hidden');
            initializeApp(user);
        } else {
            // Nenhum usuário logado. Esconde a tela de carregamento e mostra
            // a página de autenticação.
            loadingScreen.style.display = 'none';
            authPage.classList.remove('hidden');
            mainContent.classList.add('hidden');
            mainHeader.classList.add('hidden');
            mainFooter.classList.add('hidden');
            unsubscribeAll();
        }
    });

    // Troca entre forms de login e cadastro
    document.getElementById('show-register-button').addEventListener('click', () => {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });
    document.getElementById('show-login-button').addEventListener('click', () => {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Lógica de Cadastro
    document.getElementById('register-button').addEventListener('click', async () => {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const errorEl = document.getElementById('register-error');

        if (!name || !email || !password) {
            errorEl.textContent = "Por favor, preencha todos os campos.";
            return;
        }
         
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: name });
             
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                displayName: name,
                email: user.email,
                avatarUrl: 'https://placehold.co/128x128/8b5cf6/ffffff?text=A',
                myList: [],
            });
             
        } catch (error) {
            errorEl.textContent = "Erro ao cadastrar: " + error.message;
        }
    });

    // Lógica de Login
    document.getElementById('login-button').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            errorEl.textContent = "Email ou senha inválidos.";
        }
    });

    // --- LÓGICA DO PLAYER DE VÍDEO ---
    const cleanupVideoListeners = () => {
        videoPlayer.onplaying = null;
        videoPlayer.onwaiting = null;
        videoPlayer.onerror = null;
        videoPlayer.oncanplay = null;
    };

    function openPlayerWithUrl(url, openInNewTab = false) {
        if (openInNewTab) {
            window.open(url, '_blank');
            return;
        }

        videoSpinner.classList.remove('hidden');
        videoPlayerOverlay.classList.remove('hidden');
        cleanupVideoListeners();

        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        let finalUrl = url;
        try {
            const urlObject = new URL(url);
            if (urlObject.hostname.includes('api.anivideo.net') && urlObject.pathname.includes('videohls.php')) {
                const videoSrc = urlObject.searchParams.get('d');
                if (videoSrc) {
                    finalUrl = videoSrc;
                    console.log("URL de vídeo extraída:", finalUrl);
                }
            }
        } catch (e) {
            console.warn("URL inválida, usando a original:", url, e);
        }

        if (finalUrl.includes('.m3u8')) {
            if (Hls.isSupported()) {
                hlsInstance = new Hls();
                hlsInstance.loadSource(finalUrl);
                hlsInstance.attachMedia(videoPlayer);
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                    videoPlayer.play().catch(e => console.error("HLS Player Error:", e));
                });
                hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        console.error('Fatal HLS error:', data);
                        videoSpinner.classList.add('hidden');
                    }
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                videoPlayer.src = finalUrl;
                videoPlayer.play().catch(e => console.error("Native HLS Player Error:", e));
            } else {
                console.error("HLS is not supported on this browser.");
                videoSpinner.classList.add('hidden');
            }
        } else {
            videoPlayer.src = finalUrl;
            videoPlayer.play().catch(err => {
                console.error("Erro ao iniciar player:", err);
                videoSpinner.classList.add('hidden');
            });
        }

        videoPlayer.onplaying = () => videoSpinner.classList.add('hidden');
        videoPlayer.onwaiting = () => videoSpinner.classList.remove('hidden');
        videoPlayer.oncanplay = () => videoSpinner.classList.remove('hidden');
        videoPlayer.onerror = () => {
            videoSpinner.classList.add('hidden');
            console.error("Erro ao carregar o vídeo.");
        };

        history.pushState({ playerOpen: true }, 'Player');
    }

    function closePlayer() {
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        videoPlayerOverlay.classList.add('hidden');
        videoSpinner.classList.add('hidden');
        videoPlayer.pause();
        videoPlayer.src = '';
        cleanupVideoListeners();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }
    closeVideoPlayer.addEventListener('click', () => {
        if(history.state && history.state.playerOpen) {
            history.back();
        } else {
            closePlayer();
        }
    });
     
    // --- LÓGICA DE NAVEGAÇÃO E VISIBILIDADE ---
    function setActiveLink(targetId) {
        document.querySelectorAll('.nav-link, .bottom-nav-link').forEach(link => {
            const isActive = link.getAttribute('href') === `#${targetId}`;
            link.classList.toggle('active-nav-link', link.matches('.nav-link') && isActive);
            link.classList.toggle('active-bottom-nav-link', link.matches('.bottom-nav-link') && isActive);
        });
    }

    function showPage(targetId) {
        pageSections.forEach(section => section.classList.toggle('hidden', section.id !== targetId));
        setActiveLink(targetId);
        window.scrollTo(0, 0);
        detailsPage.classList.add('hidden');
        mainContent.classList.remove('hidden');
        mainHeader.classList.remove('hidden');
        mainFooter.classList.remove('hidden');
        if(targetId === 'profile-page') renderProfilePage();
    }

    function setupNavLinks() {
        document.querySelectorAll('.nav-link, .bottom-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = e.currentTarget.getAttribute('href').substring(1);
                history.pushState({ page: targetId }, '', `#${targetId}`);
                showPage(targetId);
            });
        });
    }
     
    notificationButton.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        notificationPanel.classList.toggle('hidden');
        if (!notificationPanel.classList.contains('hidden')) {
            notificationBadge.classList.add('hidden');
        }
    });
    document.addEventListener('click', () => notificationPanel.classList.add('hidden'));
     
    window.addEventListener('scroll', () => {
        mainHeader.classList.toggle('header-scrolled', window.scrollY > 50);
    });

    // --- LÓGICA DO FIRESTORE E RENDERIZAÇÃO ---
    function createContentCard(item) {
        if (!item.img) return null;
        const card = document.createElement('div');
        card.className = 'poster-card cursor-pointer group';
        card.innerHTML = `
            <img src="${item.img}" alt="${item.title}" loading="lazy" onerror="this.src='https://placehold.co/500x750/1f2937/ffffff?text=Erro'">
            <div class="poster-title">${item.title}</div>
        `;
        card.addEventListener('click', () => {
            history.pushState({ contentId: item.id }, '', `#details/${item.id}`);
            renderDetailsPage(item.id);
        });
        return card;
    }

    function displayContent(items, container, isHorizontal = false) {
        container.innerHTML = '';
        if (!items || items.length === 0) {
             if (container.id === 'search-results') document.getElementById('search-message').classList.remove('hidden');
            return;
        }
        if (container.id === 'search-results') document.getElementById('search-message').classList.add('hidden');
         
        items.forEach(item => {
            const card = createContentCard(item);
            if (card) {
                if (isHorizontal) card.classList.add('flex-shrink-0', 'w-36', 'sm:w-40', 'md:w-48');
                container.appendChild(card);
            }
        });
    }

    function renderHomePage() {
        const heroItem = allContentData.find(item => item.tags && item.tags.includes('destaque')) || allContentData[0];
        if (heroItem) {
            document.getElementById('hero-backdrop').style.backgroundImage = `url(${heroItem.bg || heroItem.img})`;
            document.getElementById('hero-title').textContent = heroItem.title;
            document.getElementById('hero-overview').textContent = heroItem.desc;
            const heroButtons = document.getElementById('hero-buttons');
            heroButtons.innerHTML = `
                <button class="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition"><i class="fa-solid fa-play"></i> Assistir Agora</button>
                <button class="bg-white/10 border border-white/20 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 hover:bg-white/20 transition"><i class="fa-solid fa-circle-info"></i> Detalhes</button>
            `;
            heroButtons.children[0].addEventListener('click', () => handleWatchButtonClick(heroItem.id));
            heroButtons.children[1].addEventListener('click', () => {
                history.pushState({ contentId: heroItem.id }, '', `#details/${heroItem.id}`);
                renderDetailsPage(heroItem.id);
            });
        }

        const carouselsContainer = document.getElementById('home-carousels-container');
        carouselsContainer.innerHTML = '';
        allCategories.forEach(category => {
            const categoryContent = allContentData.filter(item => item.tags && item.tags.includes(category.tag));
            if (categoryContent.length > 0) {
                const categorySection = document.createElement('div');
                const title = document.createElement('h3');
                title.className = 'text-2xl font-bold mb-6';
                title.textContent = category.title;
                const carouselDiv = document.createElement('div');
                carouselDiv.className = 'flex overflow-x-auto space-x-4 pb-4 scrollbar-hide';
                 
                displayContent(categoryContent, carouselDiv, true);
                 
                categorySection.appendChild(title);
                categorySection.appendChild(carouselDiv);
                carouselsContainer.appendChild(categorySection);
            }
        });
    }

    function renderMoviesPage() {
        const movies = allContentData.filter(item => item.type === 'Filme');
        displayContent(movies, document.getElementById('filmes-container'));
    }

    function renderSeriesPage() {
        const series = allContentData.filter(item => item.type === 'Série');
        displayContent(series, document.getElementById('series-container'));
    }

    function renderGenresPage() {
        const genresContainer = document.getElementById('genres-container');
        if (!genresContainer) return;
     
        const allGenres = [...new Set(allContentData.flatMap(item => item.genre || []))].sort();
         
        genresContainer.innerHTML = '';
        allGenres.forEach(genre => {
            const genreButton = document.createElement('button');
            genreButton.className = 'genre-button bg-gray-800 hover:bg-purple-600 text-white font-semibold py-3 px-5 rounded-lg transition-colors duration-300';
            genreButton.textContent = genre;
            genreButton.addEventListener('click', (e) => {
                document.querySelectorAll('.genre-button').forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                renderGenreResultsInline(genre);
            });
            genresContainer.appendChild(genreButton);
        });
    }

    function renderGenreResultsInline(genreName) {
        const results = allContentData.filter(item => item.genre && item.genre.includes(genreName));
         
        const container = document.getElementById('genre-results-inline-container');
        const title = document.getElementById('genre-results-inline-title');
        const grid = document.getElementById('genre-results-inline-grid');

        title.textContent = `Resultados para: ${genreName}`;
        displayContent(results, grid);
        container.classList.remove('hidden');
    }
     
    // --- LÓGICA DA PÁGINA DE DETALHES ---
    async function renderDetailsPage(id) {
        const item = allContentData.find(c => c.id === id);
        if (!item) {
            console.error("Conteúdo não encontrado localmente");
            showPage('inicio');
            return;
        }

        currentContentId = id;
        currentContentType = item.type;

        const isMobile = window.innerWidth < 768;
        const backgroundImageUrl = isMobile && item.bg_mobile ? item.bg_mobile : (item.bg ? item.bg : item.img);
        detailsPage.style.backgroundImage = `url(${backgroundImageUrl})`;

        const detailsOverlay = document.getElementById('details-overlay');
        detailsOverlay.className = 'absolute inset-0';
        detailsOverlay.classList.add(isMobile ? 'details-gradient-overlay-mobile' : 'details-gradient-overlay');

        document.getElementById('details-poster').src = item.img || 'https://placehold.co/500x750';
        document.getElementById('details-title').textContent = item.title || 'Título não disponível';
         
        const meta = [item.year, (item.genre || []).join(' • '), item.duration].filter(Boolean).join(' • ');
        document.getElementById('details-meta').innerHTML = meta;
        document.getElementById('details-overview').textContent = item.desc || 'Sinopse não disponível.';
         
        detailsWatchButton.onclick = () => handleWatchButtonClick(id);
         
        updateMyListButton(id);
        const newListButton = document.getElementById('details-my-list-button').cloneNode(true);
        document.getElementById('details-my-list-button').parentNode.replaceChild(newListButton, document.getElementById('details-my-list-button'));
        newListButton.addEventListener('click', () => toggleMyList(id));

        const seasonsContainer = document.getElementById('seasons-container');
        if (item.type === 'Série' && item.seasons) {
            seasonsContainer.innerHTML = '';
            seasonsContainer.classList.remove('hidden');
            Object.entries(item.seasons).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([seasonNum, seasonData]) => {
                const seasonEl = document.createElement('div');
                seasonEl.className = 'mb-6';
                seasonEl.innerHTML = `<h3 class="text-2xl font-bold mb-4">Temporada ${seasonNum}</h3>`;
                const episodesGrid = document.createElement('div');
                episodesGrid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
                 
                Object.entries(seasonData).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([epNum, epData]) => {
                    const epButton = document.createElement('button');
                    epButton.className = 'bg-white/10 border border-white/20 text-white font-semibold py-3 px-4 rounded-lg text-left hover:bg-white/20 transition';
                    epButton.innerHTML = `<span class="font-bold">${epNum}.</span> ${epData.title}`;
                    epButton.onclick = () => openPlayerWithUrl(epData.src, epData.openInNewTab);
                    episodesGrid.appendChild(epButton);
                });
                seasonEl.appendChild(episodesGrid);
                seasonsContainer.appendChild(seasonEl);
            });
        } else {
            seasonsContainer.classList.add('hidden');
        }
         
        setupRatingSystem(id, item.type);
        renderCommentsAndRating(id, item.type);
        showOverlay(detailsPage);
    }

    async function handleWatchButtonClick(id) {
        const item = allContentData.find(c => c.id === id);
        if (!item) return;

        if (item.type === 'Filme' || item.type === 'Canal') {
            openPlayerWithUrl(item.videoSrc, item.videoSrcNewTab);
        } else if (item.type === 'Série' && item.seasons) {
            try {
                const firstSeason = Object.keys(item.seasons).sort((a,b) => parseInt(a) - parseInt(b))[0];
                const firstEpisode = Object.keys(item.seasons[firstSeason]).sort((a,b) => parseInt(a) - parseInt(b))[0];
                const epData = item.seasons[firstSeason][firstEpisode];
                openPlayerWithUrl(epData.src, epData.openInNewTab);
            } catch (e) {
                console.error("Não foi possível encontrar o primeiro episódio.", e);
            }
        }
    }
     
    // --- LÓGICA MINHA LISTA ---
    async function toggleMyList(id) {
        if (!auth.currentUser) return;
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        if (currentUserData.myList.includes(id)) {
            await updateDoc(userDocRef, { myList: arrayRemove(id) });
        } else {
            await updateDoc(userDocRef, { myList: arrayUnion(id) });
        }
    }
     
    function updateMyListButton(id) {
        const button = document.getElementById('details-my-list-button');
        const isInList = currentUserData && currentUserData.myList.includes(id);
        button.innerHTML = isInList ? `<i class="fa-solid fa-check"></i> Minha Lista` : `<i class="fa-solid fa-plus"></i> Minha Lista`;
    }

    // --- LÓGICA DE PERFIL E EDIÇÃO ---
    function renderProfilePage() {
        if (!currentUserData) return;
        document.getElementById('profile-avatar').src = currentUserData.avatarUrl;
        document.getElementById('profile-username').textContent = currentUserData.displayName;
        renderMyListPage();
    }

    function renderMyListPage() {
        const myListContainer = document.getElementById('my-list-container');
        const myListMessage = document.getElementById('my-list-message');
        myListContainer.innerHTML = '';
         
        if (!currentUserData.myList || currentUserData.myList.length === 0) {
            myListMessage.classList.remove('hidden');
            return;
        }
        myListMessage.classList.add('hidden');
        const myListItems = currentUserData.myList
            .map(id => allContentData.find(content => content.id === id))
            .filter(Boolean);

        displayContent(myListItems, myListContainer);
    }

    document.getElementById('edit-profile-button').addEventListener('click', () => {
        document.getElementById('edit-username-input').value = currentUserData.displayName;
        editProfileOverlay.classList.remove('hidden');
    });

    document.getElementById('cancel-edit-profile-button').addEventListener('click', () => {
        editProfileOverlay.classList.add('hidden');
    });

    document.getElementById('save-profile-button').addEventListener('click', async () => {
        const newName = document.getElementById('edit-username-input').value.trim();
        if (newName && newName !== currentUserData.displayName) {
            await updateProfile(auth.currentUser, { displayName: newName });
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userDocRef, { displayName: newName });
        }
        editProfileOverlay.classList.add('hidden');
    });
     
    document.getElementById('change-avatar-button').addEventListener('click', () => {
        renderAvatarSelectionPage();
        avatarSelectionOverlay.classList.remove('hidden');
    });

    document.getElementById('back-to-edit-profile-button').addEventListener('click', () => {
        avatarSelectionOverlay.classList.add('hidden');
    });

    // --- LÓGICA DE SELEÇÃO DE AVATAR (REFEITA) ---
    function renderAvatarSelectionPage() {
        avatarSelectionGrid.innerHTML = ''; // Limpa o conteúdo anterior

        if (allAvatars.length === 0) {
            avatarSelectionGrid.innerHTML = '<p class="text-gray-400 text-center col-span-full">Nenhum avatar disponível.</p>';
            return;
        }

        allAvatars.forEach(category => {
            const categoryEl = document.createElement('div');
            categoryEl.innerHTML = `<h3 class="avatar-category-title">${category.name}</h3>`;
             
            const avatarsGridContainer = document.createElement('div');
            avatarsGridContainer.className = 'avatar-grid';
             
            (category.avatars || []).forEach(avatarUrl => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'avatar-choice-wrapper';
                const img = document.createElement('img');
                img.src = avatarUrl;
                img.alt = `Avatar da categoria ${category.name}`;
                img.className = 'avatar-choice';
                img.dataset.url = avatarUrl;
                 
                imgContainer.appendChild(img);
                avatarsGridContainer.appendChild(imgContainer);
            });
             
            categoryEl.appendChild(avatarsGridContainer);
            avatarSelectionGrid.appendChild(categoryEl);
        });
    }

    avatarSelectionGrid.addEventListener('click', async (e) => {
        if (e.target.classList.contains('avatar-choice')) {
            const avatarUrl = e.target.dataset.url;
            if (!avatarUrl || !auth.currentUser) return;

            try {
                // Adiciona um feedback visual imediato
                document.querySelectorAll('.avatar-choice').forEach(el => el.classList.remove('selected'));
                e.target.classList.add('selected');

                const userDocRef = doc(db, "users", auth.currentUser.uid);
                await updateDoc(userDocRef, { avatarUrl: avatarUrl });
                 
                // Fecha o overlay após um pequeno atraso para o usuário ver a seleção
                setTimeout(() => {
                    avatarSelectionOverlay.classList.add('hidden');
                }, 300);

            } catch (error) {
                console.error("Erro ao atualizar o avatar:", error);
                // Remover o feedback visual em caso de erro
                e.target.classList.remove('selected');
            }
        }
    });


    // --- LÓGICA DE AVALIAÇÃO E COMENTÁRIOS ---
    function setupRatingSystem(contentId, contentType) {
        const starContainer = document.getElementById('star-rating-container');
         
        const newStarContainer = starContainer.cloneNode(true);
        starContainer.parentNode.replaceChild(newStarContainer, starContainer);

        newStarContainer.addEventListener('click', async (e) => {
            if (e.target.matches('.fa-star')) {
                const ratingValue = parseInt(e.target.dataset.value, 10);
                if (!auth.currentUser) return;

                const key = `${contentType}_${contentId}`;
                const contentDocRef = doc(db, "content_interactions", key);
                 
                try {
                    await setDoc(contentDocRef, {
                        ratings: { [auth.currentUser.uid]: ratingValue }
                    }, { merge: true });
                } catch (error) {
                    console.error("Erro ao salvar avaliação:", error);
                }
            }
        });
    }

    function renderCommentsAndRating(contentId, contentType) {
        const key = `${contentType}_${contentId}`;
        const contentDocRef = doc(db, "content_interactions", key);
         
        const unsubscribe = onSnapshot(contentDocRef, (docSnap) => {
            if (currentContentId !== contentId) return; 

            const contentData = docSnap.exists() ? docSnap.data() : { ratings: {}, comments: [] };

            const allRatings = Object.values(contentData.ratings || {});
            const averageRating = allRatings.length ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length) : 0;
            document.getElementById('average-rating-display').innerHTML = averageRating ? `<i class="fa-solid fa-star"></i> ${averageRating.toFixed(1)}` : 'N/A';

            const currentUserRating = contentData.ratings?.[auth.currentUser.uid] || 0;
            document.querySelectorAll('#star-rating-container .fa-star').forEach(star => {
                star.classList.toggle('selected', star.dataset.value <= currentUserRating);
            });

            const commentsList = document.getElementById('comments-list');
            commentsList.innerHTML = '';
            if (contentData.comments && contentData.comments.length > 0) {
                contentData.comments.sort((a,b) => b.id - a.id).forEach(c => {
                    const el = document.createElement('div');
                    el.className = 'border-t border-gray-700/50 pt-3 mt-3 first:mt-0 first:border-0 first:pt-0';
                    const isLiked = c.likes && c.likes.includes(auth.currentUser.uid);
                    const deleteButton = c.uid === auth.currentUser.uid ? `<button class="delete-btn text-gray-500 hover:text-red-500" data-comment-id="${c.id}"><i class="fa-solid fa-trash"></i></button>` : '';
                    el.innerHTML = `
                        <div class="flex items-center mb-1">
                            <img src="${c.avatarUrl}" class="w-6 h-6 rounded-full mr-2">
                            <span class="font-bold text-sm flex-1">${c.displayName}</span>
                            ${deleteButton}
                        </div>
                        <p class="text-gray-300 text-sm mb-2">${c.text}</p>
                        <div class="flex items-center text-xs text-gray-400">
                            <button class="like-btn ${isLiked ? 'liked' : ''}" data-comment-id="${c.id}"><i class="fa-solid fa-heart"></i></button>
                            <span class="ml-1">${c.likes?.length || 0}</span>
                        </div>
                    `;
                    commentsList.appendChild(el);
                });
            } else {
                commentsList.innerHTML = '<p class="text-gray-400 text-sm">Seja o primeiro a comentar.</p>';
            }
            document.getElementById('comment-input').value = '';
        });
        unsubscribeListeners.push(unsubscribe);
    }

    // --- LÓGICA DO RODAPÉ ---
    function renderFooter() {
        const linksContainer = document.getElementById('footer-links');
        linksContainer.innerHTML = '';

        const createLink = (text, type) => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'hover:text-white transition-colors';
            link.textContent = text;
            link.onclick = (e) => {
                e.preventDefault();
                openFooterModal(text, footerSettings[type]);
            };
            return link;
        };

        if (footerSettings.telegramUrl) {
            const link = document.createElement('a');
            link.href = footerSettings.telegramUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'hover:text-white transition-colors';
            link.textContent = 'Telegram';
            linksContainer.appendChild(link);
        }
        if (footerSettings.termosContent) linksContainer.appendChild(createLink('Termos de Serviço', 'termosContent'));
        if (footerSettings.privacidadeContent) linksContainer.appendChild(createLink('Política de Privacidade', 'privacidadeContent'));
        if (footerSettings.ajudaContent) linksContainer.appendChild(createLink('Ajuda', 'ajudaContent'));
    }

    function openFooterModal(title, markdownContent) {
        document.getElementById('footer-modal-title').textContent = title;
        document.getElementById('footer-modal-content').innerHTML = marked.parse(markdownContent || 'Conteúdo não disponível.');
        footerContentModal.classList.remove('hidden');
    }
     
    closeFooterModalBtn.addEventListener('click', () => footerContentModal.classList.add('hidden'));

    // --- INICIALIZAÇÃO E ROTEAMENTO ---
    function unsubscribeAll() {
        unsubscribeListeners.forEach(unsub => unsub());
        unsubscribeListeners = [];
    }

    async function initializeApp(user) {
        unsubscribeAll();
        setupNavLinks();
         
        const userDocRef = doc(db, "users", user.uid);
        const unsubUser = onSnapshot(userDocRef, (userDoc) => {
            currentUserData = userDoc.exists() ? userDoc.data() : { displayName: user.displayName, avatarUrl: 'https://placehold.co/128x128/8b5cf6/ffffff?text=A', myList: [] };
            document.getElementById('header-avatar').src = currentUserData.avatarUrl;
            document.getElementById('profile-avatar').src = currentUserData.avatarUrl;
            document.getElementById('profile-username').textContent = currentUserData.displayName;
            if (document.getElementById('profile-page').classList.contains('hidden') === false) {
                renderMyListPage();
            }
            if (currentContentId) {
                updateMyListButton(currentContentId);
            }
        });
        unsubscribeListeners.push(unsubUser);

        // =================================================================
        // CORREÇÃO: A tela de carregamento agora é escondida aqui.
        // Isso garante que o usuário veja o conteúdo principal assim que ele
        // for carregado do Firestore, em vez de uma tela em branco.
        // Um callback de erro também foi adicionado para o caso de falha.
        // =================================================================
        const unsubContent = onSnapshot(query(collection(db, "content")), (snapshot) => {
            allContentData = snapshot.docs.map(doc => ({...doc.data(), id: doc.id }));
            handleRouting(); // Processa a rota e prepara a página para ser exibida
            loadingScreen.style.display = 'none'; // Esconde a tela de carregamento
        }, (error) => {
            console.error("Erro ao buscar conteúdo do Firestore:", error);
            // É importante esconder a tela de carregamento mesmo se houver um erro,
            // para que o aplicativo não fique travado para sempre.
            loadingScreen.style.display = 'none';
            // Opcional: mostrar uma mensagem de erro para o usuário
            document.body.innerHTML = '<div class="text-center p-8">Ocorreu um erro ao carregar o conteúdo. Por favor, tente novamente mais tarde.</div>';
        });
        unsubscribeListeners.push(unsubContent);

        const unsubCategories = onSnapshot(query(collection(db, "categories"), orderBy("order")), (snapshot) => {
            allCategories = snapshot.docs.map(doc => doc.data());
            if (location.hash === '#inicio' || location.hash === '') renderHomePage();
        });
        unsubscribeListeners.push(unsubCategories);

        const unsubAvatars = onSnapshot(query(collection(db, "avatar_categories"), orderBy("name")), (snapshot) => {
            allAvatars = snapshot.docs.map(doc => ({...doc.data(), id: doc.id}));
        });
        unsubscribeListeners.push(unsubAvatars);
         
        const unsubSettings = onSnapshot(doc(db, "settings", "footer"), (snapshot) => {
            if (snapshot.exists()) {
                footerSettings = snapshot.data();
                renderFooter();
            }
        });
        unsubscribeListeners.push(unsubSettings);
         
        const unsubNotifications = onSnapshot(query(collection(db, "notifications"), orderBy("timestamp", "desc"), limit(20)), (snapshot) => {
            const notifications = snapshot.docs.map(doc => doc.data());
            renderNotifications(notifications);
        });
        unsubscribeListeners.push(unsubNotifications);
    }
     
    function handleRouting() {
        const hash = location.hash;
        if (hash.startsWith('#details/')) {
            const id = hash.substring(9);
            renderDetailsPage(id);
        } else if (hash === '#filmes') {
            renderMoviesPage();
            showPage('filmes');
        } else if (hash === '#series') {
            renderSeriesPage();
            showPage('series');
        } else if (hash === '#generos') {
            renderGenresPage();
            showPage('generos');
        } else {
            renderHomePage();
            showPage(hash.substring(1) || 'inicio');
        }
    }

    window.addEventListener('popstate', (event) => {
        if (!videoPlayerOverlay.classList.contains('hidden')) {
            closePlayer();
        } else {
            handleRouting();
        }
    });
     
    headerSearchButton.addEventListener('click', () => { history.pushState({ page: 'buscar' }, '', '#buscar'); showPage('buscar'); });
    profileButtonHeader.addEventListener('click', () => { history.pushState({ page: 'profile-page' }, '', '#profile-page'); showPage('profile-page'); });
     
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim().toLowerCase();
        if (query) {
            const results = allContentData.filter(item => item.title.toLowerCase().includes(query));
            displayContent(results, document.getElementById('search-results'));
        }
    });
     
    document.getElementById('logout-button').addEventListener('click', () => {
        signOut(auth);
    });

    function showOverlay(element) {
        mainContent.classList.add('hidden');
        mainHeader.classList.add('hidden');
        mainFooter.classList.add('hidden');
        element.classList.remove('hidden');
    }

    // --- LÓGICA DE NOTIFICAÇÕES ---
    function renderNotifications(notifications) {
        notificationList.innerHTML = '';
        if (notifications.length === 0) {
            notificationList.innerHTML = '<p class="text-gray-400">Nenhuma notificação nova.</p>';
            notificationBadge.classList.add('hidden');
            return;
        }

        let unreadCount = 0;
        notifications.forEach(notif => {
            const isRead = notif.readBy && notif.readBy.includes(auth.currentUser.uid);
            if (!isRead) unreadCount++;

            const item = document.createElement('a');
            item.className = 'block p-2 rounded-md hover:bg-gray-800 cursor-pointer';
            item.innerHTML = `
                <p class="font-bold ${!isRead ? 'text-white' : 'text-gray-400'}">${notif.title}</p>
                <p class="text-sm ${!isRead ? 'text-gray-300' : 'text-gray-500'}">${notif.message}</p>
            `;
            if (notif.contentId) {
                item.href = `#details/${notif.contentId}`;
                item.onclick = (e) => {
                    e.preventDefault();
                    history.pushState({ contentId: notif.contentId }, '', `#details/${notif.contentId}`);
                    renderDetailsPage(notif.contentId);
                    notificationPanel.classList.add('hidden');
                };
            } else if (notif.linkUrl) {
                item.href = notif.linkUrl;
                item.target = '_blank';
            }
            notificationList.appendChild(item);
        });

        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.classList.remove('hidden');
        } else {
            notificationBadge.classList.add('hidden');
        }
    }
});
