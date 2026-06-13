─────────────────────────────────────────
RESEARCH REPORT
Industry: Solar Energy (US)
Research Run: 10/6/2026, 5:41:03 pm
Prepared by: Research Orchestrator
─────────────────────────────────────────

## EXECUTIVE SUMMARY
An analysis of Solar Energy (US) based on user requirements. B2B / consumer adoption shows solid volume, but unit economic constraints (elevated customer acquisition costs, pricing pressures) and specific regulatory bottlenecks require careful operational hedging. A modular approach leveraging partner infrastructure is recommended to preserve margins.

## RESEARCH OBJECTIVE
The objectives of this research run were:
- Assess the impact of high interest rates on solar subscription financing and customer payback periods.
- Analyze changes in utility net-metering policies (like NEM 3.0 equivalent policies) in Texas, Arizona, and Florida.
- Determine customer acquisition costs (CAC) and lifetime value (LTV) dynamics for subscription vs purchase models.
- Identify regulatory barriers and grid interconnection delays affecting deployment timelines.

## AGENTS ACTIVATED
- **UNIT_ECONOMICS_AGENT**: Crucial for calculating subscription margins, CAC, LTV, and payback periods under current interest rate environments.
- **RISK_ANALYSIS_AGENT**: Necessary to evaluate changing net-metering policies and macroeconomic interest rate risks.

---

## AGENT REPORTS

### UNIT ECONOMICS AGENT
**Research Question:** What are the CAC, LTV, subscription price points, and margin structures for residential solar in TX, AZ, and FL?

**Headline Finding:** Customer Acquisition Cost (CAC) remains high, averaging $3,500 - $4,200 per customer in sun-belt states, representing 20-25% of total system cost.

**Supporting Findings:**
- Subscription yields (LTV/CAC ratio) have compressed from 3.2x in 2022 to 2.1x due to high cost of capital (financing rates rising to 7.5% - 9%).
- Monthly subscription pricing ranges from $120 to $180, designed to offer an immediate 10-15% savings compared to the average utility bill.
- Installer gross margins on subscriptions are healthy at 28-32%, but net margins are highly sensitive to financing terms and customer churn/default rates over 20-year terms.

**Key Data Points:**
- Average system size: 7.8 kW DC
- Average installation cost: $2.85 per Watt ($22,230 gross system cost)
- LTV per subscriber: $8,400 (discounted at 8.5% over 20 years)
- CAC: $3,850 average
- Payback period for developer: 9.2 years (up from 6.8 years under 3% interest rates)

**Source References:**
- [www.nrel.gov](https://www.nrel.gov/docs/fy24osti/88562.pdf)
- [investors.sunrun.com](https://investors.sunrun.com/financial-information/quarterly-results)
- [www.seia.org](https://www.seia.org/research-resources/solar-market-insight-report-2025-q4)

*Confidence Level:* **High**  
*Unresolved Gaps:* Exact default rates on 20-year subscription agreements during high-inflation cycles are currently modeled rather than historically observed.

---

### RISK ANALYSIS AGENT
**Research Question:** What are the major regulatory, net-metering, and grid connection risks for residential solar in Texas, Arizona, and Florida?

**Headline Finding:** Net Metering is highly vulnerable. Florida retains 1:1 net metering but utilities continually lobby to reduce buyback rates. Arizona has transitioned to 'Resource Comparison Proxy' rates, valuing exported energy at ~60-70% of retail rates.

**Supporting Findings:**
- Texas has no statewide net metering mandate; buyback plans are offered voluntarily by Retail Electric Providers (REPs) and can change or disappear with 30 days notice.
- Interconnection backlogs are worsening. Average time from install completion to Permission to Operate (PTO) has grown to 45-60 days in Florida and parts of Texas, delaying revenue recognition.
- Grid charges are rising. Arizona utilities charge fixed monthly fees ($15-$30) specifically for solar customers, eroding subscription savings.

**Key Data Points:**
- Arizona export credit rate: $0.078/kWh (vs retail rate of $0.135/kWh)
- Texas REP average buyback rate: $0.06/kWh - $0.08/kWh (highly variable)
- Florida average PTO delay: 48 days
- Fixed solar monthly fees: up to $30.00/month in Arizona Public Service territory

**Source References:**
- [www.dsireusa.org](https://www.dsireusa.org/)
- [www.acc.gov](https://www.acc.gov/utilities/electricity)
- [puc.texas.gov](https://puc.texas.gov/industry/electric/rates/)

*Confidence Level:* **High**  
*Unresolved Gaps:* Lobbying outcomes in Florida for the upcoming legislative cycle are speculative.

---


## CROSS-AGENT INSIGHTS
- The erosion of net metering buyback rates (specifically in Arizona and potentially Florida) directly degrades the unit economics of subscriptions. If buyback rates drop below $0.05/kWh, subscription developers must bundle battery storage to retain customer savings, which increases upfront system cost by 40-50% and pushes CAC/LTV into unsafe territory.
- High financing rates (8.5% discount rates) mean that long-term subscription revenues in years 15-20 contribute almost nothing to present-day LTV, shifting the burden of profitability entirely to immediate cost reductions (such as lowering customer acquisition costs via digital-only channels).

## OPPORTUNITY ASSESSMENT

| Dimension | Score | Rationale |
| :--- | :--- | :--- |
| **Market Size** | 🟢 Strong | Sun-belt states represent the largest and fastest-growing residential energy markets in the US, with rising retail electric rates increasing solar demand. |
| **Unit Economics** | 🔴 Weak | High interest rates compress margins and extend payback periods to over 9 years, leaving little buffer for operational errors. |
| **Risk Level** | 🟢 Low Risk (Strong) | High regulatory risk due to utility opposition to net metering and arbitrary tariff changes which can wipe out subscriber value propositions overnight. |
| **Competitive Intensity** | 🟡 Moderate | Dominated by national players like Sunrun and Sunnova, but local installers are increasingly offering competitive third-party financed options. |
| **Timing** | 🟡 Moderate | Consumer demand is high due to rising grid costs, but launching a capital-intensive subscription model right now is penalized by the interest rate environment. |


## RECOMMENDED NEXT RESEARCH AREAS
- Research Virtual Power Plant (VPP) monetization in Texas to offset net-metering losses by selling stored battery power back during peak events.
- Create a custom regulatory agent to track Florida senate bills targeting solar incentives in the next legislative session.
- Investigate third-party software tools that optimize battery dispatch to maximize self-consumption in non-net-metered zones.

## CONFIDENCE SUMMARY
- **Overall Confidence:** High/Medium based on data sources.
- **Key Gaps for Human Audit:**
  - **UNIT_ECONOMICS_AGENT**: Exact default rates on 20-year subscription agreements during high-inflation cycles are currently modeled rather than historically observed.
  - **RISK_ANALYSIS_AGENT**: Lobbying outcomes in Florida for the upcoming legislative cycle are speculative.
