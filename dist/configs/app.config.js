const appConfig = {
    /**
     * server port
     */
    PORT: process.env.PORT ? parseInt(process.env.PORT) : 3001,
    /**
     * ngilangin properti sourceUrl di response
     *
     * jika true:
     *  {
     *    {...props}
     *    sourceUrl: "..."
     *  }
     *
     * jika false:
     *  {
     *    {...props}
     *  }
     */
    sourceUrl: true,
};
export default appConfig;
