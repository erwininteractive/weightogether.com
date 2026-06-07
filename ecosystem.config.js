module.exports = {
	apps: [
		{
			name: "wlt",
			script: "./dist/server.js",
			instances: 1,
			exec_mode: "fork",
			env_file: ".env.production",
			error_file: "./logs/pm2-error.log",
			out_file: "./logs/pm2-out.log",
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
			max_memory_restart: "500M",
			autorestart: true,
			watch: false,
			merge_logs: true,
			pre_start: "npm run db:migrate:prod && npm run db:generate",
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
