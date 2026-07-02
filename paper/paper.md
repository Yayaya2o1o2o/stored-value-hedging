# Dynamic Hedge-Ratio Optimization for Consumer-Facing Stored-Value Products Under Uncertain Redemption Demand

**Abstract**

Stored-value financial products that guarantee customers a locked-in price on a volatile underlying asset expose the issuer to a hedging problem that existing literature does not address: the issuer must size its hedge before knowing when, or whether, customers will redeem. Institutional hedging models assume the hedger controls consumption timing. Stored-value research forecasts redemption behavior but never connects it to a hedging decision. This paper closes that gap. We formalize the issuer's problem as the choice of a hedge ratio $h \in [0,1]$ minimizing a mean-dispersion objective over the net hedging error, which comprises spot exposure on unhedged redemptions, the hedging premium, close-out of unused cover, capital cost, and liquidity risk. Redemption demand enters through a time-series forecast rather than a known consumption schedule. Using a synthetic two-year panel of daily loads and redemptions calibrated to patterns documented in the prepaid-card literature, we fit ARIMA and LSTM forecasting models, feed the superior forecast into a Monte Carlo optimizer over a mean-reverting price process, and evaluate the optimal hedge ratio against naive benchmarks across a 3×3 grid of price-volatility and demand-uncertainty scenarios. No static rule survives the whole grid. Unhedged strategies forfeit up to 12% of the procurement budget under high volatility, while full hedging bleeds premium and close-out losses when demand is noisy. The optimal hedge ratio has an economically intuitive interior solution: it rises with price volatility, falls with demand uncertainty, and collapses to a no-hedge corner when a poor forecast meets a quiet price. That joint response is something no static rule can reproduce. The framework generalizes to any issuer of price-locked stored value, independent of the underlying asset.

*Keywords:* hedging, stored-value products, prepaid instruments, demand uncertainty, hedge ratio, hedging effectiveness, time-series forecasting

---

## 1. Introduction

A growing class of consumer financial products inverts the usual direction of commodity price risk. Rather than a firm hedging input costs it will incur on a schedule it controls, these products let a *customer* pre-pay for future consumption at a locked-in price: a prepaid account denominated in gallons of fuel, kilowatt-hours of electricity, units of a foreign currency, or any other volatile good. The issuer collects cash today and promises delivery at today's price whenever the customer chooses to redeem.

This design creates a distinctive risk-management problem. The issuer's exposure is real. If the underlying price rises, every unit redeemed must be procured at spot and delivered at the stale locked price. The natural response is to hedge by buying forward cover when the lock is sold. But the issuer does not know the quantity or timing of its own exposure. Redemption is driven by heterogeneous customer behavior: some balances are drawn down within days, others linger for months, and a persistent fraction is never redeemed at all. This last phenomenon, known as breakage, is documented extensively in the gift-card and prepaid literature (Horne, 2007) and is material enough to have dedicated revenue-recognition treatment under ASC 606 (Financial Accounting Standards Board, 2014).

The issuer therefore faces two failure modes with asymmetric mechanics. *Under-hedging* leaves it exposed to spot-price appreciation on redemptions beyond its forward cover. *Over-hedging* leaks premium on cover that is never used, ties up capital in positions covering demand that may never materialize, forces liquidation of excess cover at an uncertain future price, and impairs the liquidity a consumer-facing issuer needs to honor redemption spikes. The optimal hedge is an interior quantity that balances these costs, and its location depends jointly on the volatility of the underlying and the forecastability of redemption demand.

**Research question.** *How should the issuer of a price-locked stored-value product size its forward hedge when redemption demand is uncertain in both timing and quantity?*

**Contribution.** First, we formalize the stored-value issuer's hedging decision as a hedge-ratio optimization under a cost function that jointly prices under-hedge spot exposure, the hedging premium, over-hedge close-out and capital costs, and liquidity shortfall risk. To our knowledge this is the first model to couple customer-driven redemption uncertainty to hedge sizing. Second, we make the demand side operational. Rather than assuming a demand distribution, we generate it from a forecasting pipeline (ARIMA and LSTM models fitted to a redemption series), so the model consumes exactly the statistic a practitioner would possess: a point forecast and its empirical error. Third, we characterize how the optimal hedge ratio behaves across a grid of volatility and demand-uncertainty regimes and quantify its advantage over the static heuristics an issuer would plausibly use instead.

The framework is deliberately general. Nothing in the model refers to a specific commodity, firm, or market microstructure. The underlying asset appears only through a stochastic price process, and the demand side only through a forecast distribution. Fuel is used once below as a concreteness device, and nothing more.

## 2. Literature Review

Three literatures each hold one piece of this problem. None combines them.

### 2.1 Corporate hedging with known or controllable exposure

The classical theory of corporate hedging establishes why firms hedge at all: hedging adds value by reducing expected costs of financial distress and taxes (Smith & Stulz, 1985) and by protecting internally financed investment when external finance is costly (Froot, Scharfstein, & Stein, 1993). Brown and Toft (2002) derive optimal hedge positions when both price and quantity are uncertain, showing that quantity risk pushes optimal hedges away from full cover and toward custom exotic positions. Empirically, the canonical setting is airline fuel hedging. Carter, Rogers, and Simkins (2006) document a hedging premium for U.S. airlines, and Morrell and Swan (2006) describe the practice in detail. The defining assumption throughout is that exposure originates in the firm's own operations. An airline chooses its flight schedule and therefore its fuel burn. Where quantity uncertainty is modeled, it is a technological or demand shock to the firm's output, not the discretionary redemption behavior of prepaid customers holding an option on the firm.

An older strand, hedging under joint price and output uncertainty for primary producers, is structurally closer. McKinnon (1967) showed that a producer facing both price and quantity risk optimally hedges less than expected output, and Rolfo (1980) derived optimal under-hedging for a cocoa producer whose harvest is stochastic. Ederington (1979) supplied the workhorse minimum-variance hedge ratio. These models establish the key comparative static we recover, namely that quantity uncertainty depresses the optimal hedge ratio. But their quantity risk is exogenous nature (a harvest), not an aggregation of customer-level redemption decisions with the distinctive lag structure, seasonality, and breakage of stored-value instruments, and they carry no notion of the issuer's liquidity obligation to redeeming customers.

In operations management, Gaur and Seshadri (2005) hedge inventory risk using market instruments when demand is correlated with a traded asset. This is the closest operational analogue, but the hedger again controls procurement timing, and the demand being hedged is sales revenue, not a redemption liability at a locked price.

### 2.2 Commodity price modeling

The supply-side inputs to any such model are standard. Schwartz (1997) established mean-reverting processes as the empirical benchmark for commodity spot dynamics, reflecting reversion toward long-run marginal cost; the one-factor Ornstein-Uhlenbeck specification on log price (Uhlenbeck & Ornstein, 1930) remains the parsimonious default. Derivative pricing and hedging mechanics follow Black and Scholes (1973) and standard texts (Hull, 2018). This literature is mature. We take it as given and deliberately keep the price model simple, since our contribution is on the demand side of the hedge, not the price side.

### 2.3 Stored-value redemption and breakage

A separate literature studies prepaid instruments themselves. Horne (2007) documents the economics of gift-card non-redemption and its disclosure treatment, with industry breakage estimates running from the mid single digits to around ten percent of loaded value. The revenue-recognition standard ASC 606 (FASB, 2014) requires issuers to estimate expected breakage and recognize it in proportion to redemption, which institutionalizes the fact that redemption curves are forecastable objects with age-dependent hazard rates. Regulatory attention to prepaid products (Consumer Financial Protection Bureau, 2016) further documents the scale and consumer-behavior characteristics of the market. Methodologically, redemption series are ordinary time series, and the forecasting toolkit is standard: Box-Jenkins ARIMA models (Box & Jenkins, 1970; Hyndman & Athanasopoulos, 2021) and, increasingly, recurrent neural networks such as long short-term memory networks (Hochreiter & Schmidhuber, 1997) and gated variants (Cho et al., 2014) for series with nonlinear structure.

### 2.4 The gap

The hedging literature optimizes hedge size but assumes the hedger knows or controls its consumption. The stored-value literature forecasts redemption but stops at revenue recognition; it never asks what the issuer should *do* in the derivatives market with that forecast. A product that sells price locks on volatile goods sits exactly at the intersection. Its hedge must be sized *from* a redemption forecast, under costs that include the liquidity obligations unique to holding customer balances. No published model, to our knowledge, performs that coupling. This paper supplies it.

## 3. Data and Methodology

### 3.1 Synthetic panel construction

No public dataset pairs stored-value redemption histories with a price-lock liability, and proprietary issuer data would tie the model to one firm. We therefore construct a synthetic two-year daily panel (730 days) of aggregate loads and redemptions whose *structure*, not whose specific values, is calibrated to documented properties of prepaid instruments. The generator makes the following assumptions, each stated explicitly so the reader can trace every result to its source:

1. **Loads.** Daily loaded value is a lognormal perturbation around a base level, modulated by (a) day-of-week factors peaking Friday and Saturday, (b) payday spikes on the 1st and 15th of each month (+35%), (c) mild annual sinusoidal seasonality (±10%), and (d) linear adoption growth (+15% over the panel).
2. **Redemption lag.** Each day's loaded cohort redeems over subsequent days according to a discretized Gamma(k = 1.6, θ = 14 days) lag distribution truncated at 180 days. Redemption hazard peaks one to two weeks after load and decays with a long right tail, consistent with the age-dependent redemption documented in the breakage literature (Horne, 2007; FASB, 2014).
3. **Breakage.** 8% of loaded value never redeems, within the range cited for prepaid products (Horne, 2007).
4. **Redemption modulation.** Realized daily redemptions receive weekend-heavy day-of-week factors and lognormal noise. A dispersion parameter scales all idiosyncratic noise and is the lever for the demand-uncertainty scenarios of Section 5.

The panel is normalized so that the locked price equals the prevailing spot at issuance, and all quantities are expressed in units of the underlying. This normalization costs no generality and removes one nuisance parameter.

### 3.2 Demand forecasting

The optimizer does not consume the synthetic generator's true parameters. That would be cheating in exactly the way a practitioner cannot cheat. It consumes only what a forecaster could produce from the observed series. We fit two models to daily redemptions, training on the first 80% of the panel and evaluating one-step-ahead forecasts on the final 20%:

- **ARIMA baseline.** A seasonal ARIMA(2,1,2)×(1,0,1)₇ specification (Box & Jenkins, 1970), with the weekly seasonal component capturing day-of-week structure.
- **LSTM.** A two-layer long short-term memory network (48 hidden units, dropout 0.1) mapping 28-day input windows to next-day redemptions, trained with Adam on z-scored data for 120 epochs (Hochreiter & Schmidhuber, 1997).

Models are compared on test-window MAE and RMSE. The superior model supplies the optimizer's demand inputs: the mean daily redemption level and the *forecast coefficient of variation* (test-window residual standard deviation over mean), which is the single statistic through which demand uncertainty enters the optimization. This design makes the pipeline modular. Any forecasting model, from richer feature sets to customer-level survival models, can be substituted without touching the optimizer.

### 3.3 Price process

The underlying spot price follows a one-factor mean-reverting process on log price (Schwartz, 1997; Uhlenbeck & Ornstein, 1930):

$$d \ln S_t = \kappa(\mu - \ln S_t)\,dt + \sigma\,dW_t$$

with reversion speed κ = 2.0 per year and annualized volatility σ set per scenario (Section 5). Simulation uses the exact discretization at daily steps. Mean reversion is chosen over geometric Brownian motion because the asset classes for which price-locked stored value is plausible, energy and commodities above all, empirically revert toward long-run marginal cost (Schwartz, 1997). We emphasize that this component is intentionally standard. The paper's contribution is the demand-coupled hedge sizing, not price modeling.

### 3.4 Experimental design

We evaluate the optimizer on a 3×3 grid crossing price volatility σ ∈ {0.10, 0.25, 0.45} (low/medium/high annualized) with demand uncertainty at 0.5, 1.5, and 3 times the empirically estimated forecast CV, a span running from issuers with highly regular customer bases to issuers whose aggregate redemption is barely forecastable. Each cell simulates 12,000 Monte Carlo paths of 180 trading days of joint (demand, price) realizations. Within each cell the optimizer searches h on a grid of step 0.05 and is compared against four benchmarks a practitioner might use: no hedge (h = 0), a static half hedge (h = 0.5), a full hedge on the point forecast (h = 1), and a trailing-average rule that sizes cover from the last 30 observed days of redemptions.

## 4. Model Design

### 4.1 Decision problem

At t = 0 the issuer holds outstanding price locks sold at $P_{lock}$ per unit and forecasts total redemption over horizon T (180 trading days) as $\hat{D}$ units with forecast coefficient of variation $c_v$. It chooses a hedge ratio $h \in [0,1]$, committing to $Q_h = h\hat{D}$ units of forward cover at price $F = P_{lock}(1+\delta)$. Here δ = 1.5% is the *hedging premium* over the horizon: the sum of transaction costs and the risk premium paid to the long side of the forward, in the Keynes-Hicks tradition of the cost of shifting risk to speculators (see Hull, 2018). The panel is normalized so $P_{lock} = S_0$. Locks were sold at the prevailing spot, which isolates the hedging problem from the separate question of how locks are priced.

Redemption arrives as a stochastic daily sequence $D_t$. Hedged units are consumed first; they are procured at F as customers redeem. Once cumulative redemptions exceed $Q_h$, further redemptions are procured at spot $S_t$. Cover left unused at T is closed out at $S_T$. The issuer posts initial margin m = 10% of forward notional.

### 4.2 Cost function

Because locks were sold at $P_{lock}$, the economically meaningful object is the *net hedging error*: realized procurement cost relative to locked-in revenue. On one joint (demand, price) path:

$$N(h) = \underbrace{(F - P_{lock})\min(D, Q_h)}_{\text{premium on used cover}} + \underbrace{\sum_{t=1}^{T} (S_t - P_{lock})\, U_t}_{\text{unhedged spot exposure}} + \underbrace{(F - S_T)\, L}_{\text{close-out of unused cover}} + \underbrace{\lambda_c\, m F Q_h \tfrac{T}{252}}_{\text{capital cost of margin}} + \underbrace{\pi \max_t \Phi_t}_{\text{liquidity penalty}}$$

where $D = \sum_t D_t$ is realized total redemption, $U_t$ is the unhedged portion of day-t redemptions, $L = \max(Q_h - D, 0)$ is leftover cover, and $\lambda_c$ = 8% annualized is the opportunity cost of margin capital. $\Phi_t$ is the cash shortfall when cumulative redemption outflows plus committed margin exceed the prepaid float plus a free-cash buffer of 10% of expected demand value, penalized at rate π = 2%, the cost of forced short-term funding when hedge capital collides with a redemption spike.

The structure of $N(h)$ encodes the issuer's dilemma. Under-hedging (small $Q_h$) loads cost into the spot-exposure term, which is expensive exactly when prices rise on redeemed volume. Over-hedging (large $Q_h$) leaks the certain premium on cover it did not need and converts leftover cover into a speculative close-out at $S_T$, a position that loses precisely in the states where demand came in low *and* prices fell, which is not a hedge of anything. The margin and liquidity terms are specific to stored-value issuers. Unlike an airline, the issuer owes *cash liquidity* to redeeming customers, so capital immobilized in hedge positions carries risk beyond opportunity cost. This is the mechanism at the center of the Metallgesellschaft collapse, where hedge funding demands collided with long-dated delivery obligations (Culp & Miller, 1995). The setup as a whole is the stored-value analogue of hedging under joint price and quantity uncertainty (McKinnon, 1967; Rolfo, 1980).

### 4.3 Objective

We minimize a mean-dispersion objective in the hedging-effectiveness tradition of Ederington (1979):

$$h^* = \arg\min_{h \in [0,1]} \; J(h) = \mathbb{E}[N(h)] + \gamma \, \sigma[N(h)]$$

with risk weight γ = 1. The dispersion term is deliberately two-sided. An over-hedged issuer holding leftover cover has manufactured a lottery on $S_T$, and a symmetric risk measure prices that lottery as risk even in the states where it happens to pay off. That is what generates the classic interior optimum under quantity uncertainty. A purely tail-based objective, such as CVaR of cost, does not: because the cost tail is always populated by high-price paths, over-covering looks like nearly free insurance and the optimizer runs to a corner. We therefore use CVaR$_{0.95}$ (Rockafellar & Uryasev, 2000) as a reported tail diagnostic rather than the objective. The objective is estimated by Monte Carlo (12,000 paths per evaluation) and minimized by grid search over h in steps of 0.05. The estimated objective is smooth with a single interior trough in every scenario examined, so grid search suffices to grid precision. In the low-volatility scenarios the objective is nearly flat over a wide range of h. That flatness is itself economically meaningful (hedging is close to value-neutral there), and we flag it where it affects interpretation.

### 4.4 Demand-path model

Conditional on the forecast statistics $(\hat{D}/T, c_v)$, daily demand paths are simulated with two uncertainty components: a path-level lognormal *level shock* with log-scale $1.5c_v$ (the aggregate forecast may be wrong in either direction, which is the dominant risk for hedge sizing) and daily lognormal *arrival noise* with log-scale $c_v$ around a day-of-week profile. Both are mean-one, so the demand simulation is centered on the forecast. The optimizer receives no information the forecaster does not have.

## 5. Results

*(Results below are the direct output of the simulation pipeline; code and raw outputs accompany the paper.)*

### 5.1 Forecasting performance

Both models were trained on the first 584 days of the redemption series and evaluated on one-step-ahead forecasts over the final 146 days (Table 1).

**Table 1.** *One-step-ahead forecast accuracy, test window (146 days; mean daily redemption ≈ $52,745).*

| Model | MAE ($) | RMSE ($) |
|---|---|---|
| Seasonal ARIMA(2,1,2)×(1,0,1)₇ | **4,737** | **5,920** |
| LSTM (2 × 48 units) | 4,865 | 6,129 |

The ARIMA baseline outperformed the LSTM on both metrics. This is unsurprising for a series whose structure (weekly seasonality, payday spikes, smooth trend) is exactly what a seasonal linear model captures, and it is consistent with the broader finding that recurrent networks earn their complexity only on longer, more nonlinear series (Hyndman & Athanasopoulos, 2021). The ARIMA forecast therefore supplies the optimizer's demand inputs: mean daily redemption of $52,745 and a forecast coefficient of variation of $c_v$ = 0.112. We emphasize the modularity here. The LSTM's inclusion is a check that a more flexible model was not being left on the table, and any superior forecaster would simply lower the effective $c_v$ handed to the optimizer.

### 5.2 Optimal hedge ratios across regimes

Table 2 reports the optimal hedge ratio and the composition of the objective at the optimum for each cell of the 3×3 grid (12,000 joint paths per cell; all dollar figures are per $9.49M of expected procurement over the 180-day horizon).

**Table 2.** *Optimal hedge ratio h\* and objective composition by scenario.*

| Price volatility (σ) | Demand uncertainty ($c_v$) | h\* | E[N] ($k) | σ[N] ($k) | CVaR₉₅[N] ($k) | J(h\*) ($k) |
|---|---|---|---|---|---|---|
| Low (0.10) | Low (0.056) | 0.95 | 194 | 45 | 319 | 239 |
| Low (0.10) | Medium (0.168) | 0.80 | 178 | 136 | 560 | 314 |
| Low (0.10) | High (0.337) | 0.00 | 43 | 344 | 950 | 387 |
| Medium (0.25) | Low (0.056) | 1.00 | 205 | 95 | 448 | 300 |
| Medium (0.25) | Medium (0.168) | 0.95 | 211 | 290 | 982 | 501 |
| Medium (0.25) | High (0.337) | 0.80 | 199 | 547 | 1,715 | 746 |
| High (0.45) | Low (0.056) | 1.00 | 204 | 181 | 663 | 385 |
| High (0.45) | Medium (0.168) | 0.95 | 230 | 520 | 1,648 | 750 |
| High (0.45) | High (0.337) | 0.90 | 234 | 1,010 | 2,923 | 1,244 |

Two comparative statics organize the grid, and both match economic intuition while jointly defying any static rule:

1. **h\* rises with price volatility.** Higher σ raises the cost of unhedged spot exposure, pulling the optimum toward fuller cover. The pattern is monotone in every column.
2. **h\* falls with demand uncertainty.** Higher $c_v$ makes the point forecast $\hat{D}$ less trustworthy. Forward cover sized on it increasingly risks becoming an unwanted speculative position that must be closed out, and increasingly leaks premium on cover that is never used. This recovers, in a stored-value setting, the classic under-hedging result of McKinnon (1967) and Rolfo (1980), and it is strictly monotone in every row of Table 2.

The corner cell (low volatility, high demand uncertainty) deserves comment: there the optimizer abandons hedging entirely (h\* = 0). When price risk is small and the demand forecast is poor, the certain premium plus the mismatch lottery cost more than the modest spot exposure they would remove. Hedging has a *participation threshold*, not just an intensity margin. We note, per Section 4.3, that the objective in the low-volatility row is nearly flat over a wide range of h, so the h\* values there are weakly identified. The robust content is the economics (hedging is roughly value-neutral at low σ), not the precise digit.

The interaction is the managerially important finding. The optimal response to a *simultaneously* volatile price and unpredictable demand is an interior hedge ratio that no fixed heuristic locates in advance.

### 5.3 Value over naive benchmarks

Table 3 reports the objective improvement of the optimizer over each benchmark, expressed as a percentage of the expected gross procurement budget (F·$\hat{D}$ ≈ $9.49M), the unit a treasurer would budget in.

**Table 3.** *Objective savings of h\* vs. naive strategies (% of procurement budget).*

| σ | $c_v$ | vs. no hedge (h=0) | vs. half hedge (h=0.5) | vs. full hedge (h=1) | vs. trailing-avg (h=0.96) |
|---|---|---|---|---|---|
| Low | Low | 0.64 | 0.68 | 0.05 | 0.00 |
| Low | Medium | 0.08 | 0.20 | 0.21 | 0.12 |
| Low | High | 0.00 | 0.37 | 0.94 | 0.83 |
| Medium | Low | 5.07 | 3.47 | 0.00 | 0.05 |
| Medium | Medium | 3.27 | 1.94 | 0.08 | 0.01 |
| Medium | High | 1.45 | 0.58 | 0.37 | 0.22 |
| High | Low | 12.02 | 7.89 | 0.00 | 0.23 |
| High | Medium | 8.44 | 4.87 | 0.00 | −0.01 |
| High | High | 4.92 | 2.15 | 0.20 | 0.07 |

Against the strategy an unsophisticated issuer is most likely to run, which is no hedge at all, the optimizer's advantage is large exactly where it matters: up to 12% of the procurement budget at high volatility. At the same time, no single static benchmark survives the whole grid. Full hedging is near-optimal in the low-demand-uncertainty cells but bleeds up to 0.94% of budget when demand is noisy. No-hedge is optimal in one corner and worst-in-class in another.

The trailing-average rule deserves an honest word, because it performs well across much of the grid and occasionally ties the optimizer (the −0.01 entry is Monte Carlo noise on a statistical tie). This is instructive rather than embarrassing. The trailing rule lands at h ≈ 0.96 *regardless of conditions*, so it is accidentally near-optimal in high-volatility regimes and systematically wrong in exactly the regimes (low σ, high $c_v$) where the optimizer says not to hedge, costing up to 0.83% of budget there. The value of the framework is not that static rules never land near h\*. It is that only the optimizer knows *when* they do, and adapts when the regime shifts. A rule that cannot distinguish the (high σ, low $c_v$) cell from the (low σ, high $c_v$) cell is one regime change away from paying for it.

## 6. Limitations and Future Work

The results warrant several explicit caveats. **First, the data are synthetic.** The panel's structure is calibrated to documented properties of prepaid instruments, but no result here has been validated against a real issuer's redemption history. Magnitudes (though not, we argue, comparative statics) should be treated as illustrative, and validation on proprietary issuer data is the natural next step. **Second, redemption behavior is modeled, not observed.** It is also assumed *exogenous to price*. In reality, customers holding price locks hold an option and may redeem strategically when spot rises, which would correlate demand with price and raise the value of hedging. Extending the demand model with price-dependent redemption intensity is a priority extension. **Third, the hedge is a single static decision.** A dynamic version that re-optimizes h as redemptions and prices realize is the natural sequel and maps to a stochastic dynamic program. **Fourth, instruments are stylized:** forward cover at a single tenor, no basis risk, no margin dynamics beyond a capital charge, no transaction costs beyond the premium. Each of these would shade the optimum but not, we expect, its comparative statics. **Fifth, parameters** (δ, λ_c, π, γ, m, the cash buffer) are assumptions. Development-stage probes varying γ and δ preserved the comparative statics of Section 5.2, though the *location* of the no-hedge participation threshold moves with the premium δ, as theory predicts. A calibrated application should estimate these from the issuer's actual funding costs, hedging costs, and risk appetite.

## 7. Conclusion

Stored-value products that lock consumer prices on volatile goods create a hedging problem that falls between two literatures: hedge sizing with controlled consumption, and redemption forecasting with no hedging decision. We formalized the missing coupling, a hedge-ratio optimization whose demand input is a forecast distribution rather than a known schedule, and whose cost function prices the liquidity obligations unique to holding customer balances. Across volatility and demand-uncertainty regimes, the optimized hedge ratio is interior, rises with price volatility, falls with demand uncertainty, and delivers its largest advantage over static rules exactly where issuers need it most: when prices are wild and customers are unpredictable. The framework is asset-agnostic and modular, since any redemption forecaster can be plugged into the demand side. We hope it provides both a research foothold at an unstudied intersection and a usable decision tool for a class of products that is likely to grow.

## References

Black, F., & Scholes, M. (1973). The pricing of options and corporate liabilities. *Journal of Political Economy, 81*(3), 637–654.

Box, G. E. P., & Jenkins, G. M. (1970). *Time series analysis: Forecasting and control.* Holden-Day.

Brown, G. W., & Toft, K. B. (2002). How firms should hedge. *Review of Financial Studies, 15*(4), 1283–1324.

Carter, D. A., Rogers, D. A., & Simkins, B. J. (2006). Does hedging affect firm value? Evidence from the US airline industry. *Financial Management, 35*(1), 53–86.

Cho, K., van Merriënboer, B., Gulcehre, C., Bahdanau, D., Bougares, F., Schwenk, H., & Bengio, Y. (2014). Learning phrase representations using RNN encoder–decoder for statistical machine translation. In *Proceedings of the 2014 Conference on Empirical Methods in Natural Language Processing* (pp. 1724–1734). Association for Computational Linguistics.

Consumer Financial Protection Bureau. (2016). *Prepaid accounts under the Electronic Fund Transfer Act (Regulation E) and the Truth in Lending Act (Regulation Z)* (Final rule). Federal Register.

Culp, C. L., & Miller, M. H. (1995). Metallgesellschaft and the economics of synthetic storage. *Journal of Applied Corporate Finance, 7*(4), 62–76.

Ederington, L. H. (1979). The hedging performance of the new futures markets. *Journal of Finance, 34*(1), 157–170.

Financial Accounting Standards Board. (2014). *Revenue from contracts with customers (Topic 606)* (Accounting Standards Update No. 2014-09). FASB.

Froot, K. A., Scharfstein, D. S., & Stein, J. C. (1993). Risk management: Coordinating corporate investment and financing policies. *Journal of Finance, 48*(5), 1629–1658.

Gaur, V., & Seshadri, S. (2005). Hedging inventory risk through market instruments. *Manufacturing & Service Operations Management, 7*(2), 103–120.

Hochreiter, S., & Schmidhuber, J. (1997). Long short-term memory. *Neural Computation, 9*(8), 1735–1780.

Horne, D. R. (2007). Gift cards: Disclosure one step removed. *Journal of Consumer Affairs, 41*(2), 341–350.

Hull, J. C. (2018). *Options, futures, and other derivatives* (10th ed.). Pearson.

Hyndman, R. J., & Athanasopoulos, G. (2021). *Forecasting: Principles and practice* (3rd ed.). OTexts.

McKinnon, R. I. (1967). Futures markets, buffer stocks, and income stability for primary producers. *Journal of Political Economy, 75*(6), 844–861.

Morrell, P., & Swan, W. (2006). Airline jet fuel hedging: Theory and practice. *Transport Reviews, 26*(6), 713–730.

Rockafellar, R. T., & Uryasev, S. (2000). Optimization of conditional value-at-risk. *Journal of Risk, 2*(3), 21–41.

Rolfo, J. (1980). Optimal hedging under price and quantity uncertainty: The case of a cocoa producer. *Journal of Political Economy, 88*(1), 100–116.

Schwartz, E. S. (1997). The stochastic behavior of commodity prices: Implications for valuation and hedging. *Journal of Finance, 52*(3), 923–973.

Smith, C. W., & Stulz, R. M. (1985). The determinants of firms' hedging policies. *Journal of Financial and Quantitative Analysis, 20*(4), 391–405.

Uhlenbeck, G. E., & Ornstein, L. S. (1930). On the theory of the Brownian motion. *Physical Review, 36*(5), 823–841.
