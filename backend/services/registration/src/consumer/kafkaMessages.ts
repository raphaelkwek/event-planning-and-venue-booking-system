/**
 * The consumer group for one of this service's consumers (implementation.md
 * §3.1): connectsphere.registration.<consumer>, plus the laptop's
 * KAFKA_GROUP_SUFFIX, so a local consumer never takes partitions from the
 * deployed one or a teammate's.
 */
export function consumerGroup(consumer: string, suffix: string): string {
  const group = `connectsphere.registration.${consumer}`;
  return suffix ? `${group}.${suffix}` : group;
}
