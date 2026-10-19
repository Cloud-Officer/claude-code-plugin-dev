#!/usr/bin/env bash
# Opens, reuses and closes the ssm-jump tunnels declared by <ENGINE>_TUNNEL_<ENV> for query-db and analyze-db.
#   db-tunnel.sh ensure <engine> <env> [read|write]
#   db-tunnel.sh close <engine> <env> [read|write]
#   db-tunnel.sh close-all
#   db-tunnel.sh list
# <engine> is mysql, pg, mongodb, redis or es. Connection values are checked, never printed.

set -u

STATE_DIR="${XDG_STATE_HOME:-${HOME}/.local/state}/co-dev/db-tunnels"
WAIT_SECONDS="${DB_TUNNEL_WAIT:-45}"
TUNNEL_RE='^ssm-jump( +[A-Za-z0-9._:@/=-]+)+$'
FORWARD_RE='^[A-Za-z0-9._-]+:[0-9]+:[0-9]+$'

fail() {
  echo "ERROR: $*"
  exit 1
}

usage() {
  fail "usage: db-tunnel.sh ensure|close <mysql|pg|mongodb|redis|es> <env> [read|write] | close-all | list"
}

upper() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

port_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

first_set() {
  local name

  for name in "$@"; do
    if [ -n "${!name:-}" ]; then
      printf '%s' "${!name}"
      return 0
    fi
  done

  return 1
}

kill_tree() {
  local child

  for child in $(pgrep -P "$1" 2>/dev/null); do
    kill_tree "${child}"
  done

  kill "$1" 2>/dev/null
}

stop_tunnel() {
  local pid=$1 port=$2 i

  kill_tree "${pid}"

  for i in 1 2 3 4 5; do
    port_open "${port}" || return 0
    sleep 1
  done

  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  fi

  ! port_open "${port}"
}

close_state() {
  local file=$1 label pid port

  label=$(basename "${file}" .pid)
  read -r pid port <"${file}"

  if stop_tunnel "${pid}" "${port}"; then
    echo "CLOSED: ${label} tunnel on 127.0.0.1:${port}"
  else
    echo "WARNING: ${label} tunnel on 127.0.0.1:${port} is still listening after kill"
  fi

  rm -f "${file}"
}

action=${1:-}

case "${action}" in
  list)
    for file in "${STATE_DIR}"/*.pid; do
      [ -e "${file}" ] || continue
      read -r pid port <"${file}"
      if port_open "${port}"; then state=open; else state=closed; fi
      echo "$(basename "${file}" .pid) 127.0.0.1:${port} pid=${pid} ${state}"
    done
    exit 0
    ;;
  close-all)
    found=0
    for file in "${STATE_DIR}"/*.pid; do
      [ -e "${file}" ] || continue
      found=1
      close_state "${file}"
    done
    [[ "${found}" == 1 ]] || echo "NONE: no tunnel started by this skill is recorded"
    exit 0
    ;;
  ensure | close) ;;
  *) usage ;;
esac

[ $# -ge 3 ] && [ $# -le 4 ] || usage

engine=$2
env_name=$3
mode=${4:-read}

case "${engine}" in mysql | pg | mongodb | redis | es) ;; *) fail "unknown engine '${engine}' (mysql, pg, mongodb, redis or es)" ;; esac
case "${mode}" in read | write) ;; *) fail "mode must be read or write" ;; esac
[[ ${env_name} =~ ^[a-z0-9]+$ ]] || fail "environment name must match ^[a-z0-9]+\$"

case " ${DB_ENVS:-} " in
  *" ${env_name} "*) ;;
  *) fail "'${env_name}' is not listed in DB_ENVS" ;;
esac

ENV=$(upper "${env_name}")
ENGINE=$(upper "${engine}")
label="${env_name}-${engine}"
[[ "${mode}" == write ]] && label="${label}-write"
state_file="${STATE_DIR}/${label}.pid"
log_file="${STATE_DIR}/${label}.log"

if [[ "${action}" == close ]]; then
  if [ -e "${state_file}" ]; then
    close_state "${state_file}"
  else
    echo "NOT-OURS: no ${label} tunnel was started by this skill; leaving any open one alone"
  fi
  exit 0
fi

tunnel_var="${ENGINE}_TUNNEL_${ENV}"
suffixes="_${ENV} "
if [[ "${mode}" == write ]]; then
  write_var="${tunnel_var}_WRITE"
  [ -n "${!write_var:-}" ] && tunnel_var=${write_var}
  suffixes="_${ENV}_WRITE _${ENV} "
fi

tunnel=${!tunnel_var:-}

if [ -z "${tunnel}" ]; then
  echo "NONE: ${tunnel_var} is not set, so no tunnel is managed for ${engine} on ${env_name}"
  exit 0
fi

[[ ${tunnel} =~ ${TUNNEL_RE} ]] || fail "${tunnel_var} is not a plain 'ssm-jump <args>' command; not running it"

read -r -a args <<<"${tunnel}"
forward=""
i=1
while [ ${i} -lt ${#args[@]} ]; do
  case "${args[${i}]}" in
    --forward) forward=${args[$((i + 1))]:-} ;;
    --forward=*) forward=${args[${i}]#--forward=} ;;
  esac
  i=$((i + 1))
done

[[ ${forward} =~ ${FORWARD_RE} ]] || fail "${tunnel_var} has no '--forward <host>:<remote_port>:<local_port>'"
port=${forward##*:}

names=()
case "${engine}" in
  mysql) base="MYSQL_PORT" ;;
  pg) base="PGPORT" ;;
  mongodb) base="MONGODB_URI" ;;
  redis) base="REDIS_URL CACHE_DSN" ;;
  es) base="ES_URL" ;;
esac
for suffix in ${suffixes} ""; do
  for b in ${base}; do names+=("${b}${suffix}"); done
done

value=$(first_set "${names[@]}") || fail "none of ${names[*]} is set"

case "${engine}" in
  mysql | pg)
    [[ "${value}" == "${port}" ]] || fail "${tunnel_var} forwards to local port ${port} but ${names[0]} (or its fallback) is ${value}"
    ;;
  *)
    [[ ${value} =~ :${port}([/?,]|$) ]] || fail "${tunnel_var} forwards to local port ${port} but ${names[0]} (or its fallback) does not use that port"
    ;;
esac

started_by_us=""
if [ -e "${state_file}" ]; then
  read -r old_pid _ <"${state_file}"
  kill -0 "${old_pid}" 2>/dev/null && started_by_us=" (started earlier by this skill, pid ${old_pid})"
fi

warn_mongo_options() {
  [[ "${engine}" == mongodb ]] || return 0
  [[ ${value} =~ [?\&]replicaSet= && ! ${value} =~ [?\&]directConnection=true ]] && echo "WARN: ${names[0]} sets replicaSet without directConnection=true; through a tunnel the driver follows the replica set to unreachable hosts"
  [[ ${value} =~ [?\&](tls|ssl)=true && ! ${value} =~ [?\&](tlsAllowInvalidHostnames|tlsInsecure)=true ]] && echo "WARN: ${names[0]} uses TLS without tlsAllowInvalidHostnames=true; the server certificate will not match 127.0.0.1"
  return 0
}

if port_open "${port}"; then
  echo "OPEN: ${env_name} ${engine} tunnel already up on 127.0.0.1:${port}${started_by_us:- (not started by this skill; it will be left open)}"
  warn_mongo_options
  exit 0
fi

verb=OPENED
if [ -e "${state_file}" ]; then
  verb=REOPENED
  read -r old_pid old_port <"${state_file}"
  stop_tunnel "${old_pid}" "${old_port}" >/dev/null
  rm -f "${state_file}"
fi

command -v ssm-jump >/dev/null 2>&1 || fail "ssm-jump is not on PATH; install it from https://github.com/Cloud-Officer/ci-tools"

mkdir -p "${STATE_DIR}" || fail "cannot create ${STATE_DIR}"
nohup "${args[@]}" >"${log_file}" 2>&1 </dev/null &
pid=$!
disown "${pid}" 2>/dev/null
echo "${pid} ${port}" >"${state_file}"

waited=0
while [ "${waited}" -lt "${WAIT_SECONDS}" ]; do
  if port_open "${port}"; then
    echo "${verb}: ${env_name} ${engine} tunnel on 127.0.0.1:${port} (pid ${pid}, log ${log_file})"
    warn_mongo_options
    exit 0
  fi
  kill -0 "${pid}" 2>/dev/null || break
  sleep 1
  waited=$((waited + 1))
done

stop_tunnel "${pid}" "${port}" >/dev/null
rm -f "${state_file}"

echo "ERROR: ${env_name} ${engine} tunnel did not open on 127.0.0.1:${port} within ${waited}s"
echo "--- last lines of ssm-jump output (${log_file}) ---"
tail -n 20 "${log_file}" 2>/dev/null

profile=""
i=1
while [ ${i} -lt ${#args[@]} ]; do
  [[ "${args[${i}]}" == --profile ]] && profile=${args[$((i + 1))]:-}
  i=$((i + 1))
done

if grep -qiE 'sso|token (has )?expired|expired token|UnauthorizedSSOTokenError|Error loading SSO' "${log_file}" 2>/dev/null; then
  echo "HINT: SSO_EXPIRED profile=${profile:-default} — run: aws sso login${profile:+ --profile ${profile}}"
elif grep -qiE 'select|choose|#\?' "${log_file}" 2>/dev/null; then
  echo "HINT: INSTANCE_PROMPT — add -a <instance> to ${tunnel_var} so ssm-jump never asks"
fi

exit 1
