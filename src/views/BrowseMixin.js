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
    },
    filters: {
      type: Object,
      default: () => ({})
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
        else if (!this.allowExternalAccess && this.isExternal) {
          return;
        }

        // Handle external collections via internal protocol
        if (path.startsWith('internal://collections')) {
          await this.loadExternalCollections(path);
          return;
        }

        // Default behavior: resolve path and load data 
        let url = this.fromBrowserPath(path || '/');
        this.$store.dispatch("load", { url, show: true });
      }
    },
    // React to filter changes
    filters: {
      deep: true,
      async handler(newFilters, oldFilters) {
        // Only reload if we're on the collections page and filters changed
        if (this.path === 'internal://collections' && 
            JSON.stringify(newFilters) !== JSON.stringify(oldFilters)) {
          await this.loadExternalCollections(this.path, newFilters);
        }
      }
    }
  },
  methods: {
    /**
     * Load external collections or a single collection
     * @param {string} path - The path to load
     * @param {Object} filters - Optional filter parameters
     */
    async loadExternalCollections(path, filters = {}) {
      try {
        // Load list of collections
        if (path === 'internal://collections') {
          // Use filters from props if not explicitly provided
          const effectiveFilters = Object.keys(filters).length > 0 ? filters : this.filters;
          
          // Check if we're returning from a detail page and should restore state
          const hasSavedState = this.$store.state.collectionsPaginationState !== null;
          
          await this.$store.dispatch('loadExternalCollections', { 
            show: true, 
            filters: effectiveFilters,
            restoreState: hasSavedState
          });
        }
        // Load a single collection by ID
        else {
          const id = path.split('/').pop();
          await this.$store.dispatch('loadExternalCollection', { id, show: true });
        }
      } catch (error) {
        // Log loading errors
        console.error('Error loading collections:', error);
      }
    }
  }
};