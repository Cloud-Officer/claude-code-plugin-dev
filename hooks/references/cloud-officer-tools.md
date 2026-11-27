# Cloud Officer open-source tools

Public tools from github.com/Cloud-Officer that the repositories you work in may use. Prefer them over writing a new script for the same job. Install the CLIs with Homebrew: `brew tap cloud-officer/ci && brew install citools githubbuild soup`.

- `ci-tools` (`citools`): `linters` (auto-detects file types and runs the matching linters), `ssm-jump` (SSM tunnel to an EC2 instance by name, ID or IP, used for database tunnels), `deploy` (ASG, spot fleet and Lambda deployments), `cycle-keys` (rotate AWS IAM keys), `encrypt-logs` (KMS and retention for CloudWatch log groups), `generate-codeowners`, `sync-jira-release`, `brew-resources`.
- `github-build` (`githubbuild`): generates `.github/workflows/build.yml` and its companion workflows from what the repository contains (languages, linters, tests, deployments). Change its inputs and regenerate; never hand-edit the generated workflow.
- `ci-actions`: composite GitHub Actions the generated workflows reference (setup, linters, packaging, deployment). CI control flags go in the commit message: `#skip-linters`, `#skip-tests`, `#skip-all`, `#beta-deploy`, `#rc-deploy`, `#prod-deploy`.
- `soup`: lists third-party dependencies (SOUP, IEC 62304) with license and risk, and flags dangerous licenses. Run it after adding or upgrading a dependency in a medical-device or ISO-scoped repository.
- `homebrew-ci`: the Homebrew tap for `citools`, `githubbuild` and `soup`.
- `ios-frameworks`, `ios-python-wheels`: Python and AI/ML libraries prebuilt for iOS.
- `claude-code-plugin-dev`: the source of this `co-dev` plugin.
