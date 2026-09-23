const ownedCustomerIds = "SELECT ? UNION SELECT alias_customer_id FROM customer_aliases WHERE canonical_customer_id = ?";

export async function deleteCustomerInsightsAndRatings(
  database: D1Database,
  customerId: string,
): Promise<void> {
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

// Withdrawing insights consent erases the customer's stored Session Insights; ratings are kept.
export function customerSessionInsightDeletions(
  database: D1Database,
  customerId: string,
): D1PreparedStatement[] {
  return ["session_insights", "insight_session_context"].map((table) =>
    database.prepare(`DELETE FROM ${table} WHERE customer_id IN (${ownedCustomerIds})`).bind(customerId, customerId));
}
