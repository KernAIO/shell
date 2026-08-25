/**
 * Charts moved into `@kernhq/ui`.
 *
 * Only tracker draws one today, but a chart is a design-system component: the next module that
 * wants a trend on its dashboard card should find one rather than build a second.
 */
export {
  areaPath,
  BarChart,
  barLayout,
  gridLines,
  LineChart,
  linePath,
  niceMax,
  type Series,
  StackedAreaChart,
  stackSeries,
} from '@kernhq/ui'
