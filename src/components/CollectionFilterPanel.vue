<template>
  <b-card no-body class="collection-filter-panel mb-4">
    <b-card-header>
      <h5 class="mb-0">{{ $t('search.searchCollections') }}</h5>
    </b-card-header>
    <b-card-body>
      <b-form-group 
        class="filter-datetime" 
        :label="$t('search.temporalExtent')" 
        :label-for="`cfp-datetime-${filterId}`" 
        :description="$t('search.dateDescription')"
      >
        <date-picker
          :id="`cfp-datetime-${filterId}`"
          range 
          type="datetime" 
          v-model="datetimeRange" 
          input-class="form-control mx-input"
          :lang="datepickerLang" 
          :format="dateTimeFormat"
          @input="emitFilter"
        />
      </b-form-group>
    </b-card-body>
  </b-card>
</template>

<script>
import { BCard, BCardBody, BCardHeader, BForm, BFormGroup } from 'bootstrap-vue';
import DatePickerMixin from './DatePickerMixin';
import Utils from '../utils';

let filterId = 0;

export default {
  name: 'CollectionFilterPanel',
  components: {
    BCard,
    BCardBody,
    BCardHeader,
    BForm,
    BFormGroup,
    DatePicker: () => import('vue2-datepicker')
  },
  mixins: [DatePickerMixin],
  data() {
    return {
      datetimeRange: null,
      filterId: ++filterId
    };
  },
  methods: {
    emitFilter() {
      // Convert datetimeRange to UTC format similar to SearchFilter
      let datetime = null;
      if (Array.isArray(this.datetimeRange) && this.datetimeRange.length === 2) {
        datetime = this.datetimeRange.map(d => d ? Utils.dateToUTC(d) : null);
      }
      this.$emit('filter-changed', { datetime });
    }
  }
};
</script>

<style lang="scss">
@import '../theme/variables.scss';

// Datepicker related style
$default-color: map-get($theme-colors, "secondary");
$primary-color: map-get($theme-colors, "primary");

@import '~vue2-datepicker/scss/index.scss';

.collection-filter-panel {
  .mx-datepicker {
    width: 100%;
  }

  .form-group {
    > div {
      margin-left: 1em;
    }

    > label {
      font-weight: 600;
    }
  }
}
</style>
