import ErrorAlert from '../components/ErrorAlert.vue';
import Loading from '../components/Loading.vue';
import { getErrorCode, getErrorMessage } from '../store/utils';
import URI from 'urijs';
import { mapState, mapGetters } from 'vuex';

export default {
  components: {
    ErrorAlert,
    Loading
  },
  props: {
    path: {
      type: String,
      required: true
    }
  },
  computed: {
    ...mapState(["allowExternalAccess", "catalogUrl", "loading", "url"]),
    ...mapGetters(["fromBrowserPath", "error"]),
    errorId() {
      return getErrorCode(this.error);
    },
    errorDescription() {
      return getErrorMessage(this.error);
    },
    isExternal() {
      return URI(this.path).is("absolute");
    },
    //Check if path is a collections API URL (internal:// protocol)
    isCollectionsApiUrl() {
      return this.path && this.path.startsWith('internal://collections');
    }
  },
  watch: {
    // React to path changes
    path: {
      immediate: true,
      async handler(path, oldPath) {
        if (path === oldPath) {
          return;
        }

        // Block external access if not allowed
        if (!this.allowExternalAccess && this.isExternal) {
          return;
        }

        // Handle external collections from API
        if (this.isCollectionsApiUrl) {
          await this.loadExternalCollections(path);
          return;
        }

        // Default behavior
        let url = this.fromBrowserPath(path || '/');
        this.$store.dispatch("load", { url, show: true });
      }
    }
  },
  methods: {
    /**
     * Load external collections or a single collection
     * @param {string} path - The path to load
     */
    async loadExternalCollections(path) {
      try {
        // Parse the internal:// URL
        const withoutProtocol = path.replace('internal://collections', '');

        // Collections list (with or without query params)
        if (withoutProtocol === '' || withoutProtocol.startsWith('?')) {
          await this.$store.dispatch('loadExternalCollections', {
            show: true,
            paginationUrl: withoutProtocol ? path : null  // Pass full URL if has query params
          });
        }
        // Single collection
        else if (withoutProtocol.startsWith('/')) {
          const id = withoutProtocol.split('/')[1].split('?')[0];  
          await this.$store.dispatch('loadExternalCollection', {
            id,
            show: true
          });
        }
      } catch (error) {
        console.error('Error loading collections:', error);
      }
    }
  }
};