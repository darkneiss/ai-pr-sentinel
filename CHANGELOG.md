# Changelog

## 1.0.0 (2026-02-14)


### Features

* add adapter retries for gemini and ollama ([5941ce4](https://github.com/darkneiss/ai-pr-sentinel/commit/5941ce403d728508f0a1c52aa05582f76108ad99))
* add ai triage observability logs ([718ccee](https://github.com/darkneiss/ai-pr-sentinel/commit/718cceed3950bc832e7eb98569750884521a867c))
* add ai triage observability logs ([941f56f](https://github.com/darkneiss/ai-pr-sentinel/commit/941f56f7ce7503ec2ebfa6cb1435109a59512039))
* add configurable AI timeouts and raw response logging ([6487f4c](https://github.com/darkneiss/ai-pr-sentinel/commit/6487f4c63e3e1b257d283adc53fec5588868c52b))
* add langsmith observability gateway ([35f72ce](https://github.com/darkneiss/ai-pr-sentinel/commit/35f72ce058e836afd0e01dab2affa5b2e131a7ce))
* add prompt registry and versioned prompts ([9f0ed5b](https://github.com/darkneiss/ai-pr-sentinel/commit/9f0ed5b0e45d5d5e5f0697c1eb82a36620433e15))
* add retry handling for gemini and ollama ([d0a4120](https://github.com/darkneiss/ai-pr-sentinel/commit/d0a41205d14fa7d27e17b5731e783d6d3b310c4e))
* **api:** add repository context to ai triage and harden coverage ([ae9ffa3](https://github.com/darkneiss/ai-pr-sentinel/commit/ae9ffa3fb7bca806c553cdb705c2e9b4c5cee087))
* **api:** centralize SCM provider integration and generic SCM config ([#12](https://github.com/darkneiss/ai-pr-sentinel/issues/12)) ([5045bc3](https://github.com/darkneiss/ai-pr-sentinel/commit/5045bc3991354dd82f6d4e053c82261d5b462a50))
* **api:** harden ai triage normalization and provider handling ([d3ef179](https://github.com/darkneiss/ai-pr-sentinel/commit/d3ef179c3905ebcc2b8a295865b3880eb5c41fba))
* **api:** harden ai triage parsing, prompts, and observability ([15328a9](https://github.com/darkneiss/ai-pr-sentinel/commit/15328a954b8b83c2104557ba467341a9d1c2c187))
* **app:** add application entry point and starup ([61d6288](https://github.com/darkneiss/ai-pr-sentinel/commit/61d62880f8116d84fbf2b8b5627fb9db21bcf6f4))
* harden webhook ingress against replay and unauthorized repositories ([#5](https://github.com/darkneiss/ai-pr-sentinel/issues/5)) ([3ff5108](https://github.com/darkneiss/ai-pr-sentinel/commit/3ff51084321c5933a07f8d7a73893a24a5e8f500))
* **infra:** implement github governance adapter with octokit and resilience patterns ([7a81d87](https://github.com/darkneiss/ai-pr-sentinel/commit/7a81d876f1a5199369a4fbaa343e8f1ec5a95f42))
* **infrastructure:** dockerize API and harden CI/CD release publishing ([#13](https://github.com/darkneiss/ai-pr-sentinel/issues/13)) ([bfb036b](https://github.com/darkneiss/ai-pr-sentinel/commit/bfb036be3294aaf46af859d9a47607656c499d92))
* **logging:** add environment-based logger with log levels ([1cbd874](https://github.com/darkneiss/ai-pr-sentinel/commit/1cbd87455e15863f85439a42aad77ef791b7ac5a))
* stabilize ai triage hostile precedence and groq adapter ([30e93ae](https://github.com/darkneiss/ai-pr-sentinel/commit/30e93ae31f26b1e52082d6b2d1bab103f278a2eb))
* **triage:** implement ai analysis core and ([92d4c20](https://github.com/darkneiss/ai-pr-sentinel/commit/92d4c20dde17101e873afe2e51b5d0bd8d25cbc0))
* unify llm endpoint handling and logging ([2213007](https://github.com/darkneiss/ai-pr-sentinel/commit/2213007915ffbaae3779d9e4011905a04937f8f0))


### Bug Fixes

* **api:** harden webhook and lazy ai triage composition ([e35e5cd](https://github.com/darkneiss/ai-pr-sentinel/commit/e35e5cd72d41af6f123038ee4a2b12b672208cd6))
* **api:** tighten ollama output format and triage prompt ([df723df](https://github.com/darkneiss/ai-pr-sentinel/commit/df723df9c5ce54ddb1c256b778462dcbf2424b92))
* fixed problem deleting de label ([130a665](https://github.com/darkneiss/ai-pr-sentinel/commit/130a6658563dc9f47dd035040fbd2b3c2f363fe9))
* **infrastructure:** simplify compose healthcheck ([#15](https://github.com/darkneiss/ai-pr-sentinel/issues/15)) ([a630639](https://github.com/darkneiss/ai-pr-sentinel/commit/a630639d356df43d9f987aa4130fc168c10afa68))
* retry gemini and ollama requests on TimeoutError ([#6](https://github.com/darkneiss/ai-pr-sentinel/issues/6)) ([5ab3acf](https://github.com/darkneiss/ai-pr-sentinel/commit/5ab3acfa7c7bdb58fa98d5bdc92ccb93584dd0e6))
* support legacy classification-only ai responses ([7a5055e](https://github.com/darkneiss/ai-pr-sentinel/commit/7a5055e02959e8576ca38df06c2fa4c96fbacdd2))
