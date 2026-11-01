---
title: What a $197M hack and a $500M lawsuit have in common
description: A $197 million hack and a $500 million lawsuit broke the same way. What lawyers know about the 5% nobody plans for, and why legal documents deserve the audit smart contracts get.
tags: smart contracts, law, security, ai
draft: false
---
In March 2023, a crypto lending app called Euler lost $197 million. It had passed ten security audits from six firms. The hole was a button that let users donate money.

In July 2024, a faulty CrowdStrike update grounded thousands of Delta flights. Delta says it lost $500 million. CrowdStrike says its contract caps what it owes at single-digit millions. More than two years later, they are still fighting over one clause.

One is code, the other a contract. Both broke the same way: someone planned for what should happen and left out what could.

I've spent years on both sides, practicing law and writing Solidity. Developers and lawyers write in opposite ways. A developer writes as little as possible: no repetition, nothing the program doesn't need to run. A lawyer writes the same idea three times, in three different forms, and then adds "or any other" at the end. Each profession has exactly what the other one is missing.

## Who executes the contract

The real difference between a smart contract and a traditional one isn't the language. It's **who executes it**.

A smart contract is executed by a computer: deterministic, everyone knows the result before it happens. A traditional contract, when something goes wrong, is executed by a judge, and a judge is a black box. Nobody knows what will be decided, often not even the judge. That uncertainty becomes risk, and risk gets priced into everything: interest rates, insurance, prices.

A smart contract has no judge, no police, no appeal. So a well-written one assumes it **lives in a hostile environment**: anyone can call any function, in any order, with any input, and someone will try to take everything.

Different reasons, same job. The traditional contract must close every gap because its executor is unpredictable; the smart contract, because there is no one to appeal to. Both have to **map everything that can go wrong and close it in advance**.

## The 95% and the 5%

This is where the professions split.

A software engineer is trained to make things work. The focus is the happy path: the expected input, the user who behaves, the flow from the spec. That's not a flaw. It's the job. Vibe coding pushes it further: when the code comes from a prompt, the happy path is all anyone checks. It runs, the demo works, ship it. Nobody asks what happens when someone calls it in the wrong order.

Euler's donate button is what that looks like. Whoever built it pictured a generous user giving part of their deposit to the protocol. Every other button checked that your loan was still covered after you used it. This one didn't, because why would anyone donate their way into a bad loan?

The attacker did, with two accounts. With the first, he borrowed heavily, then donated away most of his deposit, leaving a loan far bigger than what backed it. That set off Euler's rescue rule: when a loan goes bad, whoever steps in to take it over gets the remaining collateral at a discount, and the worse the loan, the bigger the discount. His second account stepped in, collected the discounted collateral and cashed out. The unpaid debt stayed on the first account, which he simply abandoned, and Euler's depositors absorbed the hole.

A lawyer is trained for the opposite. Drafting a lease, a good lawyer runs through what could happen: nature (a flood), the state (a fine, a court order) and, above all, the other party, who will use every freedom the contract forgot to limit. Then closes each one in writing.

That's exactly how a security researcher thinks. The auditor, the white hat, the reverse engineer iterate attack vectors in their head, one after another. Mental fuzzing. The lawyer does the same over events, rights and loopholes instead of inputs and call orders.

**Lawyers think like hackers.** Most developers don't, because no one trained them to.

Every developer has read the proof, the MIT License:

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT...

A developer would write "no warranty." The lawyer names every kind, adds "including but not limited to" so the list can't become a limit, and covers contract, tort "or otherwise." It reads as redundant. It isn't. Every extra word closes a door before someone tries to walk through it.

## The audit nobody does

Before a serious smart contract goes live, it gets audited. Firms like OpenZeppelin publish their reports: every line read, every attack vector mapped, every finding graded by severity. Critical, High, Medium, Low, all the way down to Informational. In legal terms, an Informational finding is a missing comma that doesn't change the meaning of the sentence. A stylistic flaw, and it still makes the report.

That depth is justified. These contracts hold millions of dollars, sometimes billions.

An audit is the lawyer's mental fuzzing turned into a method: systematic, close to mathematical, built to exhaust every vector and every possibility instead of the ones that come to mind. This is what law should borrow from code.

The legal world has nothing like it. A law firm drafts the contract or the brief, someone reviews it, and it goes out. No one maps every clause against every way it can fail and grades what they find.

CrowdStrike's contract with Delta is what that looks like. A liability cap is usually written with the ordinary failure in mind: a bug, an outage, some refunds. Delta argues the cap doesn't cover gross negligence, and in May 2025 a Georgia judge let that claim go forward. Whichever side wins, the fight is over one clause, hundreds of millions of dollars, and a question nobody closed before signing.

The stakes are often higher. Legal contracts move as much money as smart contracts, sometimes more. And they don't only move money. A criminal case puts someone's liberty on the line; executives and politicians answer to proceedings that can end in fines, restricted rights or prison. A smart contract, in almost every case, touches only capital.

A contract before it's signed, a brief before it's filed, a case already underway: each deserves the audit a token contract gets as routine.

## Three auditors, one report

Today almost everyone, lawyers included, already asks AI to review their documents. Paste a contract into ChatGPT or Claude, ask for an "audit," and you get something that looks like one.

It isn't. A single model doesn't follow a method built to exhaust every vector. It's built to give an answer that is right most of the time: it covers the 95% and leaves the 5% out. That's exactly what the developer does: make it work, and stop there. The 5% is where the risk lives.

A real audit looks different. A smart contract audit report is a list of findings, and each one comes with a severity, the exact line where it lives, the scenario in which it gets exploited, and the fix. Critical means funds can be stolen. Low means an edge case worth closing. Informational is the missing comma. On Euler's code, the donate button was a Critical. On Delta's contract, so was the cap.

In crypto, a handful of firms do this work, among the best known OpenZeppelin, Trail of Bits and Spearbit. Each has its own method and its own blind spots, and each works alone. Euler hired six, and each audit was its own engagement. The donate button went through a single one, which missed it.

Imagine hiring all three. Each audits the same document independently. Then they cross-examine each other's findings: a Low that one of them flagged becomes a Critical in the hands of another, who would never have found it alone. Finally, they write one comprehensive report together.

That is what we are doing at [Asserte](https://asserte.ai), with the leading AI models in the auditors' seats.

If you have thoughts on any of this, or want to talk about it, send me an email at [dm@rafaelwerlang.com](mailto:dm@rafaelwerlang.com).
