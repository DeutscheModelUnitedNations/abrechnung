<template>
  <StatePipeline class="mb-4" :state="advance.state" :StateEnum="AdvanceState" />
  <table class="table mb-2">
    <tbody>
      <tr>
        <th scope="row">{{ t('labels.advanceRecipient') }}</th>
        <td>{{ `${formatter.name(advance.owner.name)}` }}</td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.reason') }}</th>
        <td>{{ advance.reason }}</td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.budget') }}</th>
        <td>
          <span class="tnum"> {{ formatter.money(advance.budget) }}</span>
          <span v-if="advance.budget.exchangeRate" class="text-secondary">
            &nbsp;-&nbsp;
            {{ formatter.money(advance.budget, { useExchangeRate: false }) }}
          </span>
        </td>
      </tr>
      <tr v-if="advance.offsetAgainst.length > 0">
        <th scope="row">{{ t('labels.offsetAgainst') }}</th>
        <td>
          <div class="mb-1" v-for="report in advance.offsetAgainst"><small>
            <span class="me-2 tnum">{{ formatter.money(report) }}</span>
            <i
              v-if="APP_DATA && report.type !== 'offsetEntry'"
              :class="`bi bi-${APP_DATA.displaySettings.reportTypeIcons[getReportTypeFromModelName(report.type)]} me-1`"></i>
            <a v-if="getOffsetReportLink(report)" class="clickable" role="button" @click="router.push(getOffsetReportLink(report)!)">
              {{ report.subject }}
            </a>
            <span v-else>{{ report.subject }}</span>
          </small></div>
        </td>
      </tr>
      <tr v-if="advance.state >= AdvanceState.APPROVED">
        <th scope="row">{{ t('labels.balance') }}</th>
        <td><span class="tnum"> {{ formatter.money(advance.balance) }}</span></td>
      </tr>
      <tr v-if="advance.receivedOn">
        <th scope="row">{{ t('labels.receivedOn') }}</th>
        <td>{{ formatter.date(advance.receivedOn) }}</td>
      </tr>
      <tr>
        <th scope="row">{{ t('labels.project') }}</th>
        <td>{{ `${advance.project.identifier} ${advance.project.name}` }}</td>
      </tr>
      <tr v-if="advance.comments.length > 0">
        <th scope="row">{{ t('labels.comments') }}</th>
        <td>
          <div class="mb-1" v-for="comment in advance.comments" :key="comment._id"><small>
            <b>{{ `${formatter.name(comment.author.name, 'short')}: ` }}</b>
            <span>{{ comment.text }}</span>
          </small></div>
        </td>
      </tr>
    </tbody>
  </table>
  <div v-if="showCommentForm" class="mb-3">
    <label for="advanceComment" class="form-label">{{ t('labels.comment') }}</label>
    <CTextArea id="advanceComment" v-model="newComment" />
    <button
      type="button"
      class="btn btn-secondary mt-1"
      :disabled="!newComment || addingComment"
      @click="addComment()">
      <i class="bi bi-plus-lg"></i>
      <span class="ms-1">{{ t('labels.addX', { X: t('labels.comment') }) }}</span>
    </button>
  </div>
  <div class="mb-1 d-flex align-items-center">
    <slot name="buttons"></slot>
    <button
      v-if="advance.state >= State.BOOKABLE"
      class="btn btn-primary ms-auto"
      @click="
      showFile({
        endpoint: `${props.endpointPrefix}advance/report`,
        params: { _id: advance._id },
        filename: `${advance.name}.pdf`,
        isDownloading: isDownloadingFn()
      })
    "
      :title="t('labels.report')"
      :disabled="Boolean(isDownloading)">
      <span v-if="isDownloading" class="spinner-border spinner-border-sm"></span>
      <i v-else class="bi bi-file-earmark-pdf"></i>
      <span class="ms-1">{{ t('labels.showX', { X: t('labels.report') }) }}</span>
    </button>
  </div>
</template>
<script setup lang="ts">
import { AdvanceSimple, AdvanceState, getReportTypeFromModelName, State } from 'abrechnung-common/types.js'
import { PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import API from '@/api.js'
import CTextArea from '@/components/elements/TextArea.vue'
import StatePipeline from '@/components/elements/StatePipeline.vue'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import { showFile } from '@/helper.js'

const { t } = useI18n()
const router = useRouter()

const props = defineProps({
  advance: { type: Object as PropType<AdvanceSimple<string>>, required: true },
  endpointPrefix: { type: String, default: '' },
  showCommentForm: { type: Boolean, default: true }
})

const isDownloading = ref('')
const isDownloadingFn = () => isDownloading

const newComment = ref('')
const addingComment = ref(false)
async function addComment() {
  addingComment.value = true
  const result = await API.setter<AdvanceSimple<string>>(`${props.endpointPrefix}advance/comment`, {
    _id: props.advance._id,
    comment: newComment.value
  })
  addingComment.value = false
  if (result.ok) {
    props.advance.comments = result.ok.comments
    newComment.value = ''
  }
}

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

function getOffsetReportLink(report: AdvanceSimple<string>['offsetAgainst'][number]) {
  if (report.type === 'offsetEntry' || !report.reportId) {
    return null
  }
  const reportType = getReportTypeFromModelName(report.type) as 'travel' | 'expenseReport' | 'healthCareCost'
  if (!APP_DATA.value?.user.access[`examine/${reportType}`]) {
    return null
  }
  return `/examine/${reportType}/${report.reportId}`
}
</script>
