export async function deleteCustomerInsightsAndRatings(
  database: D1Database,
  customerId: string,
): Promise<void> {
  const ownedCustomerIds = "SELECT ? UNION SELECT alias_customer_id FROM customer_aliases WHERE canonical_customer_id = ?";
  for (const table of [
    "session_insights",
    "rating_surveys",
    "insight_session_context",
    "customer_insights_consent",
  ]) {
    await database.prepare(`DELETE FROM ${table} WHERE customer_id IN (${ownedCustomerIds})`)
      .bind(customerId, customerId).run();
  }
}
