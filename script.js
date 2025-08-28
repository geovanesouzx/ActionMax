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
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    const videoPlayerOverlay = document.getElementById('video-player-overlay');
    const videoPlayer = document.getElementById('video-player');
    const closeVideoPlayer = document.getElementById('close-video-player');
    const profileButtonHeader = document.getElementById('profile-button-header');
    const pageSections = document.querySelectorAll('.page-section');
    const detailsPage = document.getElementById('details-page');
    const detailsWatchButton = document.getElementById('details-watch-button');
    const headerSearchButton = document.getElementById('header-search-button');
    const notificationButton = document.getElementById('notification-button');
    const notificationPanel = document.getElementById('notification-panel');
    const editProfileOverlay = document.getElementById('edit-profile-overlay');
    const avatarSelectionOverlay = document.getElementById('avatar-selection-overlay');
    const confirmationModal = document.getElementById('confirmation-modal');

    // --- CONSTANTES E VARIÁVEIS GLOBAIS ---
    const AVATARS = ['https://placehold.co/128x128/8b5cf6/ffffff?text=A', 'https://placehold.co/128x128/ec4899/ffffff?text=B', 'https://placehold.co/128x128/10b981/ffffff?text=C', 'https://placehold.co/128x128/f59e0b/ffffff?text=D', 'https://placehold.co/128x128/3b82f6/ffffff?text=E', 'https://placehold.co/128x128/ef4444/ffffff?text=F'];
    
    let currentUserData = null;
    let currentContentId = null;
    let currentContentType = 'movie';
    let commentToDelete = null;
    let allMedia = []; // Array para armazenar todos os filmes e séries do Firestore

    // --- LÓGICA DE INICIALIZAÇÃO E AUTENTICAÇÃO ---
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        onAuthStateChanged(auth, (user) => {
            if (user) {
                authPage.classList.add('hidden');
                initializeApp(user);
            } else {
                authPage.classList.remove('hidden');
                mainContent.classList.add('hidden');
                mainHeader.classList.add('hidden');
            }
        });
    }, 3000);

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
                avatarUrl: AVATARS[0],
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
    async function openPlayer(contentId, contentType) {
        const collectionName = contentType === 'movie' ? 'movies' : 'series';
        const mediaDocRef = doc(db, collectionName, contentId);
        const mediaDoc = await getDoc(mediaDocRef);
        if (mediaDoc.exists() && mediaDoc.data().videoUrl) {
            videoPlayer.src = mediaDoc.data().videoUrl;
            videoPlayerOverlay.classList.remove('hidden');
            try {
                await videoPlayer.play();
                if (videoPlayerOverlay.requestFullscreen) await videoPlayerOverlay.requestFullscreen();
                if (window.screen.orientation && window.screen.orientation.lock) await window.screen.orientation.lock('landscape');
            } catch (err) { console.error("Erro ao iniciar player:", err); }
        } else {
            console.error("Vídeo não encontrado para este conteúdo.");
        }
    }

    function closePlayer() {
        videoPlayerOverlay.classList.add('hidden');
        videoPlayer.pause();
        videoPlayer.src = '';
        if (document.fullscreenElement) document.exitFullscreen();
    }
    closeVideoPlayer.addEventListener('click', closePlayer);
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) closePlayer();
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
    
    notificationButton.addEventListener('click', (e) => { e.stopPropagation(); notificationPanel.classList.toggle('hidden'); });
    document.addEventListener('click', () => notificationPanel.classList.add('hidden'));
    
    window.addEventListener('scroll', () => {
        mainHeader.classList.toggle('header-scrolled', window.scrollY > 50);
    });

    // --- LÓGICA DO FIRESTORE ---
    async function fetchAllMedia() {
        try {
            const moviesSnapshot = await getDocs(collection(db, "movies"));
            const seriesSnapshot = await getDocs(collection(db, "series"));

            const movies = moviesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const series = seriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            allMedia = [...movies, ...series];
        } catch (error) {
            console.error("Erro ao buscar mídia do Firestore:", error);
        }
    }

    function createContentCard(item) {
        if (!item.posterUrl) return null;
        const card = document.createElement('div');
        card.className = 'poster-card cursor-pointer group';
        const title = item.title || item.name;
        card.innerHTML = `
            <img src="${item.posterUrl}" alt="${title}" loading="lazy" onerror="this.src='https://placehold.co/500x750/1f2937/ffffff?text=Erro'">
            <div class="poster-title">${title}</div>
        `;
        card.addEventListener('click', () => {
            history.pushState({ contentId: item.id, type: item.type }, '', `#${item.type}/${item.id}`);
            renderDetailsPage(item.id, item.type);
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

    function displayHeroContent() {
        if (allMedia.length > 0) {
            const heroItem = allMedia[Math.floor(Math.random() * allMedia.length)];
            document.getElementById('hero-backdrop').style.backgroundImage = `url(${heroItem.backdropUrl})`;
            document.getElementById('hero-title').textContent = heroItem.title || heroItem.name;
            document.getElementById('hero-overview').textContent = heroItem.overview;
            const heroButtons = document.getElementById('hero-buttons');
            heroButtons.innerHTML = `
                <button class="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition"><i class="fa-solid fa-play"></i> Assistir Agora</button>
                <button class="bg-white/10 border border-white/20 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 hover:bg-white/20 transition"><i class="fa-solid fa-circle-info"></i> Detalhes</button>
            `;
            heroButtons.children[0].addEventListener('click', () => openPlayer(heroItem.id, heroItem.type));
            heroButtons.children[1].addEventListener('click', () => {
                history.pushState({ contentId: heroItem.id, type: heroItem.type }, '', `#${heroItem.type}/${heroItem.id}`);
                renderDetailsPage(heroItem.id, heroItem.type);
            });
        }
    }
    
    // --- LÓGICA DA PÁGINA DE DETALHES ---
    async function renderDetailsPage(id, type) {
        const collectionName = type === 'movie' ? 'movies' : 'series';
        const mediaDocRef = doc(db, collectionName, id);
        const mediaDoc = await getDoc(mediaDocRef);

        if (!mediaDoc.exists()) {
            console.error("Conteúdo não encontrado no Firestore");
            return;
        }
        const data = mediaDoc.data();
        currentContentId = id;
        currentContentType = data.type;

        const isMobile = window.innerWidth < 768;
        const backgroundImageUrl = isMobile && data.posterUrl ? data.posterUrl : (data.backdropUrl ? data.backdropUrl : '');
        detailsPage.style.backgroundImage = `url(${backgroundImageUrl})`;

        const detailsOverlay = document.getElementById('details-overlay');
        detailsOverlay.className = 'absolute inset-0'; // Reset classes
        if(isMobile) {
            detailsOverlay.classList.add('details-gradient-overlay-mobile');
        } else {
            detailsOverlay.classList.add('details-gradient-overlay');
        }

        document.getElementById('details-poster').src = data.posterUrl ? data.posterUrl : 'https://placehold.co/500x750';
        document.getElementById('details-title').textContent = data.title || data.name || 'Título não disponível';
        
        const year = data.releaseDate ? data.releaseDate.split('-')[0] : 'N/A';
        const genres = data.genres ? data.genres.join(' • ') : '';
        const formattedRuntime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}min` : '';

        document.getElementById('details-meta').innerHTML = `<span>${year}</span> • <span>${genres}</span> • <span>${formattedRuntime}</span>`;
        document.getElementById('details-overview').textContent = data.overview || 'Sinopse não disponível.';
        
        detailsWatchButton.onclick = () => openPlayer(id, data.type);
        
        updateMyListButton(id);
        const newListButton = document.getElementById('details-my-list-button').cloneNode(true);
        document.getElementById('details-my-list-button').parentNode.replaceChild(newListButton, document.getElementById('details-my-list-button'));
        newListButton.addEventListener('click', () => toggleMyList(id));
        
        renderCommentsAndRating(id);
        showOverlay(detailsPage);
    }
    
    // --- LÓGICA MINHA LISTA ---
    async function toggleMyList(id) {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        if (currentUserData.myList.includes(id)) {
            await updateDoc(userDocRef, { myList: arrayRemove(id) });
            currentUserData.myList = currentUserData.myList.filter(item => item !== id);
        } else {
            await updateDoc(userDocRef, { myList: arrayUnion(id) });
            currentUserData.myList.push(id);
        }
        updateMyListButton(id);
    }
    
    function updateMyListButton(id) {
        const button = document.getElementById('details-my-list-button');
        const isInList = currentUserData.myList.includes(id);
        button.innerHTML = isInList ? `<i class="fa-solid fa-check"></i> Minha Lista` : `<i class="fa-solid fa-plus"></i> Minha Lista`;
    }

    // --- LÓGICA DE PERFIL E EDIÇÃO ---
    function renderProfilePage() {
        document.getElementById('profile-avatar').src = currentUserData.avatarUrl;
        document.getElementById('profile-username').textContent = currentUserData.displayName;
        renderMyListPage();
    }

    async function renderMyListPage() {
        const myListContainer = document.getElementById('my-list-container');
        const myListMessage = document.getElementById('my-list-message');
        myListContainer.innerHTML = '';
        
        if (!currentUserData.myList || currentUserData.myList.length === 0) {
            myListMessage.classList.remove('hidden');
            return;
        }
        myListMessage.classList.add('hidden');
        for (const id of currentUserData.myList) {
            const item = allMedia.find(media => media.id === id);
            if (item) {
                const card = createContentCard(item);
                if(card) myListContainer.appendChild(card);
            } else {
                console.warn(`Item com ID ${id} da "Minha Lista" não foi encontrado.`);
            }
        }
    }

    document.getElementById('edit-profile-button').addEventListener('click', () => {
        document.getElementById('edit-username-input').value = currentUserData.displayName;
        showOverlay(editProfileOverlay);
    });

    document.getElementById('cancel-edit-profile-button').addEventListener('click', () => {
        hideOverlay(editProfileOverlay);
        showPage('profile-page');
    });

    document.getElementById('save-profile-button').addEventListener('click', async () => {
        const newName = document.getElementById('edit-username-input').value.trim();
        if (newName && newName !== currentUserData.displayName) {
            await updateProfile(auth.currentUser, { displayName: newName });
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userDocRef, { displayName: newName });
            currentUserData.displayName = newName;
        }
        hideOverlay(editProfileOverlay);
        showPage('profile-page');
    });
    
    document.getElementById('change-avatar-button').addEventListener('click', () => {
        const grid = document.getElementById('avatar-selection-grid');
        grid.innerHTML = '';
        AVATARS.forEach(avatarUrl => {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.className = 'w-24 h-24 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform';
            img.onclick = async () => {
                const userDocRef = doc(db, "users", auth.currentUser.uid);
                await updateDoc(userDocRef, { avatarUrl: avatarUrl });
                currentUserData.avatarUrl = avatarUrl;
                hideOverlay(avatarSelectionOverlay);
                showPage('profile-page');
            };
            grid.appendChild(img);
        });
        showOverlay(avatarSelectionOverlay);
    });

    document.getElementById('back-to-edit-profile-button').addEventListener('click', () => {
        hideOverlay(avatarSelectionOverlay);
        showOverlay(editProfileOverlay);
    });

    // --- LÓGICA DE AVALIAÇÃO E COMENTÁRIOS ---
    async function renderCommentsAndRating(contentId) {
        const key = `${currentContentType}_${contentId}`;
        const contentDocRef = doc(db, "content", key);
        const contentDoc = await getDoc(contentDocRef);
        const contentData = contentDoc.exists() ? contentDoc.data() : { ratings: {}, comments: [] };

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
            contentData.comments.forEach(c => {
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
    }

    document.getElementById('star-rating-container').addEventListener('click', async (e) => {
        if (e.target.matches('.fa-star')) {
            const rating = parseInt(e.target.dataset.value);
            const key = `${currentContentType}_${currentContentId}`;
            const contentDocRef = doc(db, "content", key);
            
            await setDoc(contentDocRef, { 
                ratings: { [auth.currentUser.uid]: rating } 
            }, { merge: true });

            renderCommentsAndRating(currentContentId);
        }
    });

    document.getElementById('submit-comment-button').addEventListener('click', async () => {
        const text = document.getElementById('comment-input').value.trim();
        if (!text) return;

        const key = `${currentContentType}_${currentContentId}`;
        const contentDocRef = doc(db, "content", key);
        
        const newComment = { 
            id: Date.now(), 
            uid: auth.currentUser.uid, 
            displayName: currentUserData.displayName, 
            avatarUrl: currentUserData.avatarUrl, 
            text: text, 
            likes: [] 
        };

        await setDoc(contentDocRef, { comments: arrayUnion(newComment) }, { merge: true });
        renderCommentsAndRating(currentContentId);
    });

    document.getElementById('comments-list').addEventListener('click', (e) => {
        const target = e.target.closest('.like-btn, .delete-btn');
        if (!target) return;
        
        commentToDelete = Number(target.dataset.commentId);

        if (target.matches('.like-btn')) {
            toggleCommentLike(commentToDelete);
        } else if (target.matches('.delete-btn')) {
            confirmationModal.classList.remove('hidden');
        }
    });

    async function toggleCommentLike(commentId) {
        const key = `${currentContentType}_${currentContentId}`;
        const contentDocRef = doc(db, "content", key);
        const contentDoc = await getDoc(contentDocRef);
        if (!contentDoc.exists()) return;

        const comments = contentDoc.data().comments || [];
        const commentIndex = comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return;
        
        const commentData = comments[commentIndex];
        const userLikeIndex = commentData.likes.indexOf(auth.currentUser.uid);
        if (userLikeIndex > -1) {
            commentData.likes.splice(userLikeIndex, 1);
        } else {
            commentData.likes.push(auth.currentUser.uid);
        }
        await updateDoc(contentDocRef, { comments: comments });
        renderCommentsAndRating(currentContentId);
    }
    
    document.getElementById('cancel-delete-button').addEventListener('click', () => {
        confirmationModal.classList.add('hidden');
        commentToDelete = null;
    });

    document.getElementById('confirm-delete-button').addEventListener('click', async () => {
        if (commentToDelete === null) return;
        
        const key = `${currentContentType}_${currentContentId}`;
        const contentDocRef = doc(db, "content", key);
        const contentDoc = await getDoc(contentDocRef);
        if (!contentDoc.exists()) return;

        let comments = contentDoc.data().comments || [];
        const commentData = comments.find(c => c.id === commentToDelete);

        if (commentData && commentData.uid === auth.currentUser.uid) {
            comments = comments.filter(c => c.id !== commentToDelete);
            await updateDoc(contentDocRef, { comments: comments });
            renderCommentsAndRating(currentContentId);
        }
        confirmationModal.classList.add('hidden');
        commentToDelete = null;
    });

    // --- INICIALIZAÇÃO E ROTEAMENTO ---
    async function initializeApp(user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
        } else {
            currentUserData = { displayName: user.displayName, avatarUrl: AVATARS[0], myList: [] };
        }

        setupNavLinks();
        document.getElementById('header-avatar').src = currentUserData.avatarUrl.replace('128x128', '40x40');
        
        await fetchAllMedia();

        displayHeroContent();
        
        const movies = allMedia.filter(item => item.type === 'movie');
        const series = allMedia.filter(item => item.type === 'tv');

        displayContent(movies, document.getElementById('popular-movies'), true);
        displayContent(movies.slice().reverse(), document.getElementById('new-releases'), true);
        displayContent(series, document.getElementById('series-container'));
        displayContent(movies, document.getElementById('filmes-container'));
        
        document.getElementById('genres-container').innerHTML = '<p class="text-gray-400">Funcionalidade de Gêneros em desenvolvimento.</p>';
        
        handleRouting();
    }
    
    function handleRouting() {
        const hash = location.hash;
        if (hash.startsWith('#movie/') || hash.startsWith('#tv/')) {
            const [type, id] = hash.substring(1).split('/');
            renderDetailsPage(id, type);
        } else {
            showPage(hash.substring(1) || 'inicio');
        }
    }

    window.addEventListener('popstate', () => handleRouting());
    
    headerSearchButton.addEventListener('click', () => { history.pushState({ page: 'buscar' }, '', '#buscar'); showPage('buscar'); });
    profileButtonHeader.addEventListener('click', () => { history.pushState({ page: 'profile-page' }, '', '#profile-page'); showPage('profile-page'); });
    
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim().toLowerCase();
        if (query) {
            const results = allMedia.filter(item => (item.title || item.name).toLowerCase().includes(query));
            displayContent(results, document.getElementById('search-results'));
        }
    });
    
    document.getElementById('logout-button').addEventListener('click', () => {
        signOut(auth);
    });

    function showOverlay(element) {
        document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
        mainContent.classList.add('hidden');
        mainHeader.classList.add('hidden');
        element.classList.remove('hidden');
    }
    function hideOverlay(element) {
        element.classList.add('hidden');
    }
});
