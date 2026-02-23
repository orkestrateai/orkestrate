# Formal Agent Notation (Draft 1.0)

A mathematically coherent framework for expressing the behavior, orchestration, and topology of single-agent and multi-agent systems via symbolic expressions.

## 1. Core State & Environment Definitions
To build a rigorous foundation, we must define the spaces in which agents operate.

*   $\mathcal{I}$: The space of all possible inputs (e.g., user prompts, multimodal percepts, system messages).
*   $\mathcal{O}$: The space of all possible outputs (e.g., text generations, structured JSON, tool-call requests).
*   $\mathcal{S}$: The internal state space of the agent. For LLMs, this is typically the bounded context window or scratchpad memory.
*   $\mathcal{E}$: The environment state topological space (e.g., the state of an external database, filesystem, or DOM).
*   $\mathcal{T}$: A set of tools. A tool $\tau \in \mathcal{T}$ is a deterministic or stochastic mapping representing an environment interaction: 
    $$ \tau: \mathcal{O}_{call} \times \mathcal{E} \rightarrow \mathcal{I}_{result} \times \mathcal{E} $$
    *(A tool takes a call request and external environment state, returning a result input to the agent and an mutated environment state).*

## 2. The Formal Agent ($\mathcal{A}$)
At its core, an autoregressive agent is governed by a stochastic policy parametrized by weights $\theta$.

Let $\pi_\theta(o \mid i, s)$ be the probability distribution over outputs $o \in \mathcal{O}$, given a current input $i \in \mathcal{I}$ and internal state $s \in \mathcal{S}$.

We define an Agent Formal Tuple:
$$ A = \langle \mathcal{I}, \mathcal{O}, \mathcal{S}, \mathcal{T}, \pi_\theta, \delta \rangle $$

Where $\delta$ is the **state transition function** (memory update mechanism):
$$ \delta: \mathcal{S} \times \mathcal{I} \times \mathcal{O} \rightarrow \mathcal{S} $$

### 2.1 Agent Execution Step (The Generate-Update Loop)
A single discrete execution step $t$ for agent $A$ is expressed as sampling from the policy and updating the state:
$$ o_t \sim \pi_\theta(\cdot \mid i_t, s_t) $$
$$ s_{t+1} = \delta(s_t, i_t, o_t) $$

If the output $o_t$ maps to a tool invocation $\tau_{req}$, the environment resolves it:
$$ (i_{next}, e_{t+1}) = \tau(o_t, e_t) $$

For brevity in higher-level orchestration notation, we can abstract the internal policy and write the agent application as a mapping:
$$ A(i, s) \rightarrow (o, s') $$

---

## 3. Multi-Agent Composition Operators
When moving from single-agent generation to multi-agent orchestration, we define strict algebraic operators. Let $A, B, C$ be distinct agents.

### 3.1 Sequential Composition ($\rightarrow$ or $\circ$)
*Agent $B$ consumes the terminal output of Agent $A$ as its input.*
$$ A \rightarrow B \equiv B(A(i)_{out}, s_B) $$
$$ (\text{or algebraically: } (B \circ A)(i) = B(A(i)) ) $$

### 3.2 Parallel / Broadcast Execution ($\parallel$)
*An input $i$ is broadcasted to $n$ independent agents simultaneously, yielding a vector of outputs.*
$$ \parallel_{k=1}^n A_k(i) = \begin{bmatrix} A_1(i) \\ A_2(i) \\ \vdots \\ A_n(i) \end{bmatrix} $$

### 3.3 Conditional Routing ($\mapsto$)
*A Router Agent $R$ acts as a classifier, assessing condition set $\mathcal{C}$ and dynamically routing the execution path to a specific downstream agent.*
Let $R_{cls}: \mathcal{I} \rightarrow \{1, 2, \dots, n\}$ be the router's decision mapping.
$$ R \mapsto \{A_1, A_2, \dots, A_n\} $$
**Evaluation:** The system resolves to executing $A_k(i)$ iff $R_{cls}(i) = k$.

### 3.4 Synthesizer (Map-Reduce / Scatter-Gather) ($\diamond$)
*A Synthesizer Agent $S$ aggregates and reduces an input sequence or parallel output matrix into a unified response.*
Given a set of parallel worker agents $W_1 \dots W_n$:
$$ S \diamond (W_1 \parallel W_2 \parallel \dots \parallel W_n) $$
**Evaluation:** $S \Big( \big[ W_1(i), W_2(i), \dots, W_n(i) \big] \Big)$

### 3.5 The Reflection / Iterative Loop Operator ($\circlearrowleft$)
*An agent $A$ executes iteratively until a termination condition evaluator $\Phi_{stop}(o, s)$ evaluates to $True$.* 
$$ A^{\circlearrowleft \Phi} $$
**Evaluation:** 
1. $o_k, s_{k+1} \leftarrow A(i_k, s_k)$
2. If $\Phi_{stop}(o_k, s_{k+1}) == 1$, return $o_k$.
3. Else, $i_{k+1} = \text{CriticFeedback}(o_k)$, goto 1.

### 3.6 Hierarchical Delegation ($\rhd$)
*A Supervisor Agent $H$ creates bounded execution contexts for a Sub-Agent $W$. $H$ yields control to $W$, but $H$ retains interrupt privileges and assimilates $W$'s final state.*
$$ H \rhd W $$
Unlike sequential $\rightarrow$, delegation $\rhd$ implies $W$ acts as a subroutine/tool within $H$'s broader state lifecycle, rather than a final handoff.
