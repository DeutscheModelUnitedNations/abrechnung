<template>
  <div class="mb-3">
    <label v-if="modelValue.length > 1" class="form-label mb-0">{{ t('labels.cost') }}</label>
    <div v-if="!ownCar && modelValue.length > 1" class="row g-2 mb-2 align-items-end">
      <div class="col-auto" style="min-width: 180px">
        <label class="form-label">{{ t('labels.currency') }} <span class="text-danger">*</span></label>
        <CurrencySelector :model-value="currency" @update:model-value="(c) => emit('update:currency', c)" :disabled="disabled" required />
      </div>
      <div class="col-auto">
        <small class="text-secondary tnum">{{ t('labels.total') }}: {{ money(getCostGrossAmount({ positions: modelValue })) }}</small>
      </div>
    </div>
    <div v-if="modelValue.length !== 1" class="d-flex align-items-center mb-2">
      <label class="form-label mb-0">{{ t('labels.position') }} <span v-if="required || ownCar" class="text-danger">*</span></label>
      <button v-if="!disabled && !ownCar" type="button" class="btn btn-sm btn-outline-secondary ms-auto" @click="addPosition">
        <i class="bi bi-plus-lg"></i> {{ t('labels.add') }}
      </button>
    </div>
    <div
      v-for="(position, index) in modelValue"
      :key="position._id || index"
      :class="modelValue.length > 1 ? 'border rounded p-3 mb-2' : 'mb-2'">
      <div class="row g-2 position-relative">
        <div v-if="positionDescriptionRequired(position)" :class="canRemovePosition(position) ? 'col-md-5' : 'col-md-6'">
          <label class="form-label">{{ t('labels.description') }} <span class="text-danger">*</span></label>
          <input v-model="position.description" type="text" class="form-control" required :disabled="disabled" @change="changed" >
        </div>
        <div :class="amountColumn(position)">
          <label class="form-label">
            {{ t('labels.amount') }}<template v-if="vatEnabled(position)"> ({{ t('labels.grossAmount') }})</template>
            <span v-if="amountRequired" class="text-danger">*</span>
          </label>
          <div v-if="!ownCar && modelValue.length === 1" class="input-group">
            <input
              v-model.number="position.grossAmount"
              type="number"
              step="0.01"
              class="form-control tnum"
              :required="amountRequired"
              :disabled="disabled"
              @change="amountChanged(position)" >
            <CurrencySelector
              :model-value="currency"
              @update:model-value="(c) => emit('update:currency', c)"
              :disabled="disabled"
              required />
          </div>
          <input
            v-else
            v-model.number="position.grossAmount"
            type="number"
            step="0.01"
            class="form-control tnum"
            :required="amountRequired"
            :disabled="disabled || position.kind === 'ownCar'"
            @change="amountChanged(position)" >
        </div>
        <div v-if="vatEnabled(position)" class="col-md-3">
          <label class="form-label">{{ t('labels.vatRate') }} <span class="text-danger">*</span></label>
          <select v-model.number="position.vatRate" class="form-select" required :disabled="disabled" @change="changed">
            <option v-for="rate in vatRates(position)" :key="rate" :value="rate">{{ rate }} %</option>
          </select>
        </div>
        <div v-if="canRemovePosition(position)" class="position-absolute top-0 end-0 w-auto">
          <button type="button" class="btn btn-sm btn-outline-danger" :title="t('labels.delete')" @click="removePosition(index)">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div v-if="!lockProject" class="col-md-6">
          <label class="form-label">{{ t('labels.project') }} <span class="text-danger">*</span></label>
          <ProjectSelector
            :model-value="position.project"
            :disabled="disabled"
            @update:model-value="(project) => setProject(position, project)" />
        </div>
        <div :class="lockProject ? 'col-md-12' : 'col-md-6'">
          <label class="form-label">{{ t('labels.category') }} <span class="text-danger">*</span></label>
          <CategorySelector v-model="position.category" :report-type="reportType" :disabled="disabled" required @update:model-value="changed" />
        </div>
      </div>
      <div v-if="vatEnabled(position)" class="d-flex align-items-center mt-2">
        <small class="text-secondary tnum">
          {{ t('labels.netAmount') }}: {{ money(getCostPositionNetAmount(position, vatEnabled(position))) }} ·
          {{ t('labels.vatAmount') }}: {{ money(getCostPositionVatAmount(position, vatEnabled(position))) }}
        </small>
      </div>
    </div>
    <button
      v-if="modelValue.length === 1 && !disabled && !ownCar"
      type="button"
      class="btn btn-sm btn-link px-0"
      @click="addPosition">
      {{ t('labels.addX', { X: t('labels.position') }) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { Category, CostPosition, Currency, idDocumentToId, ProjectSimple } from 'abrechnung-common/types.js'
import { getCostGrossAmount, getCostPositionNetAmount, getCostPositionVatAmount } from 'abrechnung-common/utils/scripts.js'
import { PropType, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import CategorySelector from './CategorySelector.vue'
import CurrencySelector from './CurrencySelector.vue'
import ProjectSelector from './ProjectSelector.vue'

const { t } = useI18n()
const APP_DATA = APP_LOADER.data
const props = defineProps({
  modelValue: { type: Array as PropType<CostPosition<string>[]>, required: true },
  defaultProject: { type: Object as PropType<ProjectSimple<string>>, required: true },
  reportType: { type: String as PropType<'Travel' | 'ExpenseReport'>, required: true },
  disabled: { type: Boolean, default: false },
  ownCar: { type: Boolean, default: false },
  currency: { type: Object as PropType<Currency>, required: true },
  required: { type: Boolean, default: true },
  amountRequired: { type: Boolean, default: true },
  requireSinglePositionDescription: { type: Boolean, default: true },
  lockProject: { type: Boolean, default: false },
  vatEnabled: { type: Boolean, default: true }
})
const emit = defineEmits<{ 'update:modelValue': [CostPosition<string>[]]; 'update:currency': [Currency] }>()

function defaultCategory() {
  const categories = APP_DATA.value?.categories.filter(({ for: value }) => value === 'both' || value === props.reportType) ?? []
  return categories.find(({ isDefault }) => isDefault) ?? (categories.length === 1 ? categories[0] : undefined)
}

function createPosition(kind: CostPosition['kind'] = 'manual') {
  return {
    kind,
    ...(kind === 'manual' ? { description: '' } : {}),
    grossAmount: 0,
    vatRate: 0,
    project: props.defaultProject,
    category: defaultCategory() as Category<string>
  }
}

function ensurePosition() {
  if (props.modelValue.length === 0 && (props.required || props.ownCar)) {
    emit('update:modelValue', [createPosition(props.ownCar ? 'ownCar' : 'manual')])
    return
  }
  let changedPosition = false
  const positions = props.modelValue.map((position) => {
    const category = position.category ?? defaultCategory()
    const vatRate = position.kind === 'ownCar' || !props.vatEnabled || !vatRates(position).includes(position.vatRate) ? 0 : position.vatRate
    const project = props.lockProject ? props.defaultProject : position.project
    if (category === position.category && vatRate === position.vatRate && project === position.project) return position
    changedPosition = true
    return { ...position, category: category as Category<string>, vatRate, project }
  })
  if (changedPosition) emit('update:modelValue', positions)
}

function changed() {
  emit('update:modelValue', [...props.modelValue])
}
function amountChanged(position: CostPosition<string>) {
  if (!props.amountRequired && !Number.isFinite(position.grossAmount)) position.grossAmount = 0
  changed()
}
function addPosition() {
  emit('update:modelValue', [...props.modelValue, createPosition()])
}
function removePosition(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, positionIndex) => positionIndex !== index))
}
function canRemovePosition(position: CostPosition<string>) {
  return !props.disabled && position.kind === 'manual' && (props.modelValue.length > 1 || !props.required)
}
function positionDescriptionRequired(position: CostPosition<string>) {
  return position.kind === 'manual' && (props.requireSinglePositionDescription || props.modelValue.length > 1)
}
function amountColumn(position: CostPosition<string>) {
  if (positionDescriptionRequired(position)) return 'col-md-3'
  if (canRemovePosition(position)) return vatEnabled(position) ? 'col-md-8' : 'col-md-11'
  return vatEnabled(position) ? 'col-md-9' : 'col-md-12'
}
function organisation(position: CostPosition<string>) {
  const projectOrganisation = idDocumentToId(position.project.organisation).toString()
  return APP_DATA.value?.organisations.find(({ _id }) => _id === projectOrganisation)
}
function vatEnabled(position: CostPosition<string>) {
  return props.vatEnabled && position.kind !== 'ownCar' && Boolean(organisation(position)?.accountingSettings.vatAccountingEnabled)
}
function vatRates(position: CostPosition<string>) {
  return organisation(position)?.accountingSettings.vatRates.map(({ rate }) => rate) ?? [0]
}
function setProject(position: CostPosition<string>, project: ProjectSimple<string>) {
  position.project = project
  if (position.kind === 'ownCar' || !props.vatEnabled || !vatRates(position).includes(position.vatRate)) position.vatRate = 0
  changed()
}
function money(amount: number) {
  return formatter.currency(amount, props.currency._id)
}

watch([() => props.modelValue, () => props.defaultProject], ensurePosition, { immediate: true })
</script>
