import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const Alert = withReactContent(Swal);

// Ajout des styles CSS en ligne
const swalStyles = `
  .swal-custom {
    max-width: 90%; /* Réduit la largeur sur mobile */
    width: auto;
    padding: 1rem; /* Espacement interne */
    font-size: 0.875rem; /* Taille de texte réduite (14px) */
    border-radius: 0.5rem; /* Coins arrondis */
  }

  @media (min-width: 640px) {
    .swal-custom {
      max-width: 28rem; /* Largeur plus grande sur écrans moyens */
      font-size: 1rem; /* Taille de texte normale (16px) */
      padding: 1.5rem; /* Plus de padding sur les écrans larges */
    }
  }
`;

// Injecte les styles dans le document
const injectStyles = () => {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = swalStyles;
  document.head.appendChild(styleTag);
};

// Injecter les styles au démarrage
injectStyles();

const AlertService = {
  success: (title: string, text?: string) => {
    Alert.fire({
      icon: 'success',
      title,
      text,
      showConfirmButton: false,
      timer: 2000,
      customClass: {
        popup: 'swal-custom', // Classe personnalisée
      },
    });
  },
  error: (title: string, text?: string) => {
    Alert.fire({
      icon: 'error',
      title,
      text,
      showConfirmButton: true,
      customClass: {
        popup: 'swal-custom', // Classe personnalisée
      },
    });
  },
  validation: (title: string, text?: string) => {
    Alert.fire({
      icon: 'warning',
      title,
      text,
      showConfirmButton: true,
      customClass: {
        popup: 'swal-custom', // Classe personnalisée
      },
    });
  },
  warning: (title: string, text?: string) => {
    Alert.fire({
      icon: 'warning',
      title,
      text,
      showConfirmButton: true,
      customClass: {
        popup: 'swal-custom', // Classe personnalisée
      },
    });
  },
  infoWithCallback: (title: string, text: string, callback: () => void) => {
    Alert.fire({
      icon: 'info',
      title,
      text,
      showConfirmButton: true,
      customClass: {
        popup: 'swal-custom', // Classe personnalisée
      },
    }).then((result) => {
      if (result.isConfirmed) {
        callback();
      }
    });
  },
};

export default AlertService;
