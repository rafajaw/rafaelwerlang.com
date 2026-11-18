---
title: A move learned in one language model works in another
description: Four separately trained language models arrange meaning alike, and a transformation measured in one, carried through a single linear map, works in another about 13 times better than a generic push. Not a silver bullet, but far from nothing. Plus a confound in a public backdoor model zoo.
tags: ai, interpretability, security, research
draft: false
---
On the outside, a language model is just a next-token predictor. Different companies train them on different data, with different architectures. There is no reason, in principle, for their insides to look alike.

They do. That much was known for concepts: different models place words in similar ways. I wanted to know something stronger. Do they also share the *moves* between meanings, like plural, opposite, or capital of? And if they do, can a move measured in one model be used in another?

I tested it on four 7–8B models from four families (Mistral, Qwen, OLMo, Granite), always against an untrained copy of the same network as a floor.

## The moves are arranged alike

**Concepts first.** Three models measured, similarity 0.90–0.93; untrained copies near zero.

**Then the moves.** For about twenty word transformations, the pattern of how the moves relate to each other agrees across all four families, 0.94–0.97, with no map between the models at all. Four companies, four training runs, the same arrangement.

One trap on the way. The obvious way to build these "task vectors" still carries the words of the examples. "Opposite" always uses adjectives, "capital of" always uses country names, so any network that groups tasks by their words will look like it shares them, even an untrained one: random networks agreed almost as well (0.81–0.93) as the trained models. The fix is to subtract the same examples with their answers shuffled ("hot: low", "tall: cold"): same words, no relation. Then the untrained networks drop to near zero, and the trained models still agree at 0.94–0.97. If you read a claim that models share task vectors, ask whether it had that control.

## And a move carries over

Take a move measured in one model, pass it through one linear map fitted on unrelated text, add it to the other model's state on a bare question, and check the first word of the answer:

- nothing added: right 1% of the time;
- a generic push: 4%;
- the wrong move, carried: 5%;
- **the carried move: 52%;**
- the target's own move: 84%.

About 13 times the generic push, and 62% of what the model gets from its own version. In nearly half of the cases, the carried move reached at least three quarters of the target's own effect. A refusal direction carried too: removing the carried direction made two different models comply with harmful requests, getting most of the way (63–100%) to removing their own.

It is not a silver bullet. The best numbers use some help from the target model (its own scale, its own generic push), and only the first word is scored. But a move learned in one model working in another, through a single linear map, is not nothing.

## Where it stopped

**A backdoor's fingerprint did not carry across families.** The best case came within 0.01 of the bar I set and no further, even with maps that fit well. And a candidate "damage" direction that passed one test failed a broader one: it labelled half of unpleasant-but-intact changes as damage. So did each model's own version, which points at how the direction was extracted rather than at the transfer.

## A finding on the way

To test backdoor detection fairly, I first used a public model zoo of backdoored and clean adapters. Its released metadata shows every poisoned adapter trained for 4 epochs and every clean one for 2. A trivial statistic, how much the weights changed, then separates them perfectly. Any detector evaluated on that zoo may be detecting training length, not backdoors. I trained my own matched pairs instead, identical except for the poison, and the trivial statistic stopped working.

## What I take from it

Models trained apart converge on the same geometry of meaning, and part of what one model does can be moved into another with one linear map. Safety work that finds a behaviour in one model has a real, if partial, path to the others. What did not carry yet is the part I would most like to: the subtle fingerprint of a planted backdoor, so that one found in one model could be looked for in another.

Paper: [PDF](/papers/llmi-preprint.pdf). Code, results and checkers that re-derive most of the numbers: [github.com/rafajaw/llmi](https://github.com/rafajaw/llmi).
